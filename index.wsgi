import os, sys, time
from configparser import ConfigParser

# =============================================================================
# 1) CONFIG FILE
# =============================================================================
import sqlite3
from flask import Response
from flask import json
from flask.templating import render_template
from flask import request


class DefCP(ConfigParser):
    def get(self, option, *args, **kwargs):
        return super().get('DEFAULT', option, **kwargs)

c = DefCP()
mydir = os.path.dirname(__file__)
c.read(os.path.join(mydir, 'config.ini'))

# -------------------------------------------
# Add required dependencies to the path.
# -------------------------------------------
paths = c.get('pythonpath', fallback='').split(':')
for path in paths:
    sys.path.insert(0, path)


# -------------------------------------------
# Import other modules.
# -------------------------------------------
from freki.serialize import FrekiDoc, FrekiLine

# -------------------------------------------
# Do other environment setup.
# -------------------------------------------
freki_root = c.get('freki_root')


# =============================================================================
# URLs
# =============================================================================

from flask import Flask

app = Flask(__name__)
application = app

def tagsort(tag):
    tagorder = ['L','G','T','M','O']
    if tag in tagorder:
        return tagorder.index(tag)
    else:
        return len(tagorder)

config = {k:c.get(k) for k in c.defaults().keys()}
config['tags'] = sorted(c.get('tags').split(','), key=tagsort)
config['flags'] = sorted(c.get('flags').split(','))

@app.route('/')
def home():
    return render_template('home.html', **config)

@app.route('/valid/<dir>')
def isvalid(dir):
    full_dir_path = os.path.join(freki_root, os.path.basename(dir))
    if os.path.exists(full_dir_path):
        return json.dumps({'dir':dir, 'exists':True})
    else:
        return json.dumps({'dir':dir, 'exists':False})


@app.route('/dir/<dir>')
def dir_list(dir):
    full_dir_path = os.path.join(freki_root, os.path.basename(dir))
    contents = os.listdir(full_dir_path)
    saves = modified_files(dir)
    # sys.stderr.write('{}\n'.format(saves))

    return render_template('browser.html',
                           contents=contents,
                           dir=dir,
                           saves=saves,
                           **config)

@app.route('/load/<dir>/<doc_id>')
def load_dir(dir, doc_id):
    fd = FrekiDoc.read(os.path.join(os.path.join(freki_root, dir), doc_id))
    # sys.stderr.write(c.get('base_url')+'\n')
    return render_template('doc.html',
                           fd=fd,
                           doc_id=doc_id,
                           **config)

@app.route('/save/<dir>/<doc_id>', methods=['POST'])
def save(dir, doc_id, data=None):
    if data is None:
        data = request.get_json()

    line_dict = data['lines']
    line_numbers = sorted([int(i) for i in line_dict.keys()])

    path = os.path.join(os.path.join(freki_root, dir), doc_id)

    span_count = 0

    fd = FrekiDoc.read(path)
    for lineno in line_numbers:
        line = fd.get_line(lineno)
        old_tag = line.tag
        flags = old_tag.split('+')[1:]
        new_tag = line_dict[str(lineno)]['tag'].upper()

        if new_tag != 'NOISY':
            assign_tag = '+'.join([new_tag] + flags)
            line.tag = assign_tag

        if new_tag != 'O':
            if line_dict[str(lineno)].get('span') == 'new-span':
                span_count += 1
            line.span_id = '{}'.format(span_count)
        else:
            line.span_id = ''



        # sys.stderr.write('{} {}\n'.format(line.tag, assign_tag))

    with open(path, 'w') as f:
        f.write(str(fd))
    save_to_db(dir, doc_id)

    return json.jsonify({'success':True})

@app.route('/finish/<dir>/<doc_id>', methods=['POST'])
def finish(dir, doc_id):
    data = request.get_json()
    save(dir, doc_id, data=data)
    flag_complete(dir, doc_id)
    return Response(response='OK', status=200)


# Just write that a file was saved, and the timestamp
# so that we can log modifications.
db_path = os.path.join(os.path.dirname(__file__), 'saves.db')
def save_to_db(dir, file):
    db = sqlite3.connect(db_path)
    db.execute("""CREATE TABLE IF NOT EXISTS saves
                                        (dir TEXT,
                                        file TEXT,
                                        modified REAL,
                                        complete INTEGER)""")

    db.execute("""INSERT OR REPLACE INTO saves VALUES ('{}', '{}', {}, 0)""".format(dir, file, time.time()))
    db.commit()
    db.close()

def flag_complete(dir, file):
    db = sqlite3.connect(db_path)
    c = db.execute("SELECT * FROM saves WHERE dir = '{}' AND file='{}'".format(dir, file))
    if not (c.fetchall()):
        db.execute("INSERT INTO saves VALUES ('{}', '{}', {}, 1)".format(dir, file, time.time()))
    else:
        db.execute("UPDATE saves SET complete = 1 WHERE dir = '{}' and file = '{}'".format(dir, file))
    db.commit()
    db.close()


def modified_files(dir):
    if not os.path.exists(db_path):
        return {}
    else:
        db = sqlite3.connect(db_path)
        c = db.execute("""SELECT * FROM saves WHERE dir = '{}'""".format(dir))
        return {file:bool(complete) for dir, file, timestamp, complete in c.fetchall()}
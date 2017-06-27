import os, sys, time
import string
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
    contents = sorted(os.listdir(full_dir_path), key=lambda x: int(x.split('.')[0]))
    saves = modified_files(dir)
    # sys.stderr.write('{}\n'.format(saves))

    return render_template('browser.html',
                           contents=contents,
                           dir=dir,
                           saves=saves,
                           **config)

def get_fd_info(fd):
    """
    Return a dict of span types for each line: prev, new, or cont(inuing)
    
    :type fd: FrekiDoc 
    :rtype: dict
    """
    line_dict = {}

    for lineno in fd.linemap:
        line = fd.linemap[lineno]
        line_dict[lineno] = {'line':line}
        assert isinstance(line, FrekiLine)

        prev_span_id = fd.linemap[lineno-1].span_id if lineno > 1 else None

        span_parts = line.span_id.split('-') if line.span_id else 0

        # It's a "new span" if transitioning from
        # no span_id or if the previous line's span_id
        # doesn't match this one.
        new_span = (line.span_id is not None and
                    (prev_span_id == None or
                    line.span_id != prev_span_id))

        # It's a "continuing" span if this span_id
        # has a letter suffix that's not "a"
        span_cont = (line.span_id is not None and
                     len(span_parts) > 1 and
                     span_parts[1] in string.ascii_lowercase and
                     span_parts[1] != 'a')

        span_type = 'prev'
        if new_span and not span_cont:
            span_type = 'new'
        elif new_span and span_cont:
            span_type = 'cont'

        line_dict[lineno]['span_type'] = span_type
    return line_dict


@app.route('/load/<dir>/<doc_id>')
def load_dir(dir, doc_id):
    fd = FrekiDoc.read(os.path.join(os.path.join(freki_root, dir), doc_id))
    fd_info = get_fd_info(fd)
    # sys.stderr.write(c.get('base_url')+'\n')
    return render_template('doc.html',
                           fd=fd,
                           doc_id=doc_id,
                           fd_info=fd_info,
                           **config)

def assign_spans(line_data):
    """
    From the dict of line data, 
    create a span_id for each line.
    """
    span_dict = {}

    line_numbers = sorted([int(i) for i in line_data.keys()])
    span_count = 0

    def get_span_type(lineno): return line_data[str(lineno)].get('span')
    def name_lettered_span(span_num, num_prev_spans): return 's{}-{}'.format(span_num, string.ascii_lowercase[num_prev_spans])

    cur_span = None

    for lineno in line_numbers:
        span_type = get_span_type(lineno)

        if span_type == 'new-span':
            span_count += 1
            cur_span = 's{}'.format(span_count)
            span_dict[lineno] = cur_span
        elif span_type == 'cont-span':
            # If the current span is "continuing,"
            # walk backward until a "new" span is
            # seen. This will make this span
            # n+1
            num_prev_spans = 0
            prev_line_counter = lineno-1
            while prev_line_counter > 0:
                prev_span_type = get_span_type(prev_line_counter)
                if prev_span_type == 'new-span':
                    num_prev_spans += 1
                    span_dict[prev_line_counter] = name_lettered_span(span_count, 0)
                    break
                elif prev_span_type == 'cont-span':
                    num_prev_spans += 1

                prev_line_counter -=1

            span_dict[lineno] = name_lettered_span(span_count, num_prev_spans)

    # One more pass for the "prev_spans"
    cur_span = None
    for lineno in line_numbers:
        span_type = get_span_type(lineno)
        if span_type in ['new-span', 'cont-span']:
            cur_span = span_dict[lineno]
        elif span_type == 'prev-span':
            span_dict[lineno] = cur_span

    return span_dict

@app.route('/save/<dir>/<doc_id>', methods=['POST'])
def save(dir, doc_id, data=None):
    """
    Save the data from the editor to file.
    """
    if data is None:
        data = request.get_json()

    line_dict = data['lines']

    line_numbers = sorted([int(i) for i in line_dict.keys()])
    span_ids = assign_spans(line_dict)
    sys.stderr.write(str(span_ids)+'\n')

    path = os.path.join(os.path.join(freki_root, dir), doc_id)

    fd = FrekiDoc.read(path)
    for lineno in line_numbers:
        line = fd.get_line(lineno)
        old_tag = line.tag
        old_flags = old_tag.split('+')[1:]

        new_flags = line_dict[str(lineno)].get('flags', [])
        new_tag = line_dict[str(lineno)]['tag'].upper()

        if new_tag == 'O':
            line.tag = None
        elif new_tag != 'NOISY':
            assign_tag = '+'.join([new_tag] + new_flags)
            line.tag = assign_tag

        line.span_id = span_ids.get(lineno)



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
    """    
    Flag this file as "complete" in the database. 
    
    :param dir: The directory that the file is contained in 
    :param file: The filename    
    """
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
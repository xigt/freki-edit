import os, sys
from configparser import ConfigParser

# =============================================================================
# 1) CONFIG FILE
# =============================================================================
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
tags = c.get('tags').split(',')

# =============================================================================
# URLs
# =============================================================================

from flask import Flask

app = Flask(__name__)
application = app

config = {k:c.get(k) for k in c.defaults().keys()}
config['tags'] = c.get('tags').split(',')


@app.route('/dir/<dir>')
def hello_world(dir):
    dir = os.path.join(freki_root, dir)
    contents = os.listdir(dir)
    return render_template('browser.html',
                           contents=contents,
                           dir=os.path.basename(dir),
                           **config)

@app.route('/load/<dir>/<doc_id>')
def load_dir(dir, doc_id):
    fd = FrekiDoc.read(os.path.join(os.path.join(freki_root, dir), doc_id))
    sys.stderr.write(c.get('base_url')+'\n')
    return render_template('doc.html',
                           fd=fd,
                           doc_id=doc_id,
                           **config)

@app.route('/save/<dir>/<doc_id>', methods=['POST'])
def save(dir, doc_id):
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

    return json.jsonify({'success':True})


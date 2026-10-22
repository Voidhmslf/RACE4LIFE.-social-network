import marshal
import json
import sys

def load_pyc(name):
    with open(f'__pycache__/{name}.cpython-311.pyc', 'rb') as f:
        f.seek(16)
        code = marshal.load(f)
        g = {}
        exec(code, g)
        return g

f1 = load_pyc('data_f1')['F1_VARIATIONS']
sci = load_pyc('data_sci')['SCIENCE_VARIATIONS']
sim = load_pyc('data_sim')['SIM_VARIATIONS']
trk = load_pyc('data_trk')['TRACK_VARIATIONS']

all_vars = {}
all_vars.update(f1)
all_vars.update(sci)
all_vars.update(trk)
all_vars.update(sim)

with open('topics_overview.txt', 'w', encoding='utf-8') as out:
    for tid, var_list in all_vars.items():
        out.write(f"=== {tid} ({len(var_list)} variations) ===\n")
        for i, v in enumerate(var_list):
            out.write(f"  [{i}] {v['title']}\n")
            out.write(f"      EXCERPT: {v['excerpt']}\n")
print(f"Total topics: {len(all_vars)}, total variations: {sum(len(v) for v in all_vars.values())}")

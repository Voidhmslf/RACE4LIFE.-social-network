# -*- coding: utf-8 -*-
"""
Unified F1 Content Data (all 16 topics x 8 variations = 128 articles)
"""

from f1_content_data_part1 import get_part1
from f1_part1_b import get_f1_3_to_7
from f1_part1_c import get_f1_5_to_7
from f1_content_data_part2 import get_f1_8_to_11
from f1_content_data_part3 import get_f1_12_to_15

def get_f1_data():
    all_data = {}
    all_data.update(get_part1())
    all_data.update(get_f1_3_to_7())
    all_data.update(get_f1_5_to_7())
    all_data.update(get_f1_8_to_11())
    all_data.update(get_f1_12_to_15())
    return all_data

if __name__ == '__main__':
    d = get_f1_data()
    print(f"Total F1 topics loaded: {len(d)}")
    for k in sorted(d.keys(), key=lambda x: int(x.split('_')[1])):
        print(f"  {k}: {len(d[k])} variations")

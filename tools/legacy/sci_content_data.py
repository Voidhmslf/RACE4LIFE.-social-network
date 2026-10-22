# -*- coding: utf-8 -*-
"""
Unified Science Content Data (all 15 topics x 8 variations = 120 articles)
"""

from sci_content_part1 import get_sci_part1
from sci_content_part1_b import get_sci_part1_b
from sci_content_part2 import get_sci_part2
from sci_content_part3 import get_sci_part3

def get_sci_data():
    all_data = {}
    all_data.update(get_sci_part1())      # sci_0 .. sci_3
    all_data.update(get_sci_part1_b())    # sci_4 .. sci_5
    all_data.update(get_sci_part2())      # sci_6 .. sci_10
    all_data.update(get_sci_part3())      # sci_11 .. sci_14
    return all_data

if __name__ == '__main__':
    d = get_sci_data()
    print(f"Total Science topics loaded: {len(d)}")
    for k in sorted(d.keys(), key=lambda x: int(x.split('_')[1])):
        print(f"  {k}: {len(d[k])} variations")

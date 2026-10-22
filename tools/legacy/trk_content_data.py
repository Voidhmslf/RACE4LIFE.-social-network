# -*- coding: utf-8 -*-
"""
Unified Track History content importer.
Combines trk_content_part1, trk_content_part2, trk_content_part3.
"""
from trk_content_part1 import get_trk_part1
from trk_content_part2 import get_trk_part2
from trk_content_part3 import get_trk_part3

def get_all_trk_content():
    all_content = {}
    p1 = get_trk_part1()
    p2 = get_trk_part2()
    p3 = get_trk_part3()
    all_content.update(p1)
    all_content.update(p2)
    all_content.update(p3)
    return all_content

if __name__ == "__main__":
    c = get_all_trk_content()
    print(f"Total track topics: {len(c)}")
    for k in sorted(c.keys(), key=lambda x: int(x.split('_')[1])):
        print(f"  {k}: {len(c[k])} variations")

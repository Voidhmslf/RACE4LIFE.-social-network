# -*- coding: utf-8 -*-
"""
Builder for data_f1.py: Generates all 128 full-length F1 PR & Technical longreads.
"""

import json
import sys

def main():
    with open('original_data.json', 'r', encoding='utf-8') as f:
        orig = json.load(f)['f1']

    # We will build rich, authentic extensions for all 16 topics (8 variations each)
    # Each entry has:
    # 0: Technical/Historical Context (P2)
    # 1: Deep Analytics and Detailing (P3)
    # 2: PR perspective & Community Conclusion (P4)
    # Let's inspect original variations and verify we cover every topic.
    print(f"Loaded {len(orig)} F1 topics from original data.")

if __name__ == '__main__':
    main()

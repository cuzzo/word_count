#! /usr/bin/env python

from __future__ import division

import sys

import operator
import re

punctuation_chars = re.compile('["()\[\]\',.!?%$;:]')

def read_file(fname):
    f = open(fname, 'r')
    text = f.read()
    f.close()
    return text

def prepare_text(text):
    text = text.lower()
    text = text.replace('--', ' ')
    return text

def group_words(text):
    words = text.split()
    dict = {}
    for word in words:
        word = punctuation_chars.sub('', word)
        if word in dict:
            dict[word] += 1
        else:
            dict[word] = 1
    return dict


def sort_word_dict(dict):
    sorted_dict = sorted(dict.iteritems(),
                         key=operator.itemgetter(1),
                         reverse=True)
    return sorted_dict

def get_stats(formatted_text, dict):
    word_count = 0
    character_count = 0

    words = formatted_text.split()
    for word in words:
        word_count += 1
        character_count += len(word)

    unique_words = len(dict)
    return {
       'total words': word_count,
       'percentage unique words': unique_words / word_count,
       'average word length': character_count / word_count
    }

def diagnose(raw_text):
    text = prepare_text(raw_text)
    dict = group_words(text)
    tuples = sort_word_dict(dict)
    stats = get_stats(text, dict)

    print stats
    for tuple in tuples:
        print tuple

if __name__ == '__main__':
    raw_text = read_file(sys.argv[1])
    diagnose(raw_text)

#! /usr/bin/env node

var SYL_LEN = 3; // Constant for average syllable length
var fs = require("fs");

function sort_dictionary(dict) {
  var tuples = [];
  for (var key in dict) {
    tuples.push([key, dict[key]]);
  }

  tuples.sort(function(a, b) {
    return a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0;
  });

  return tuples;
}


function blob_text(str) {
  var spaced_text = str.replace(/\s/g, " ");
  return spaced_text.replace(/\s{2,}/g, " ");
}

function remove_multiple_spaces(str) {
  var single_spaced_str = str.replace(/[ \t]{2,}/g, " ");
  return single_spaced_str.replace(/\n{2,}/g, "\n");
}

function get_paragraphs(str) {
  var raw_paragraphs = str.split("\n");
  var paragraphs = [];
  raw_paragraphs.forEach(function(paragraph) {
    if (!paragraph.match(/[a-zA-Z0-9]/g)) {
      return false;
    }
    paragraphs.push(paragraph);
    return true;
  });
  return paragraphs
}

function get_sentences(text_blob) {
  return text_blob.split(/\.[\s\"\']/g);
}

function get_words(text_blob) {
  raw_words = text_blob.split(" ");
  var words = [];
  raw_words.forEach(function(word) {
    if (!word.match(/[a-zA-Z0-9]/g)) {
      return false;
    }
    words.push(word);
    return true;
  });
  return words;
}

function get_scene_count(paragraphs) {
  var scene_count = 0;
  paragraphs.forEach(function(paragraph) {
    if (paragraph[0] !== "\t") {
      scene_count += 1;
    }
  });
  return scene_count;
}

function get_dialogue(paragraphs) {
  var dialogue_bits = [];
  paragraphs.forEach(function(paragraph) {
    while ((opening_quote = paragraph.indexOf("\"")) !== -1) {
      var closing_quote = paragraph.slice(opening_quote + 1).indexOf("\"");
      if (closing_quote === -1) {
        dialogue_bits.push(paragraph.slice(opening_quote + 1));
        break;
      }

      dialogue_bits.push(paragraph.slice(opening_quote + 1, closing_quote));
      paragraph = paragraph.slice(opening_quote + closing_quote + 2);
    }
  });
  return dialogue_bits;
}

function clean_word(str) {
  var cleaned_word = str.toLowerCase();
  cleaned_word = cleaned_word.replace(/^[\s\"\.!;:\'\(\)]/, "");
  return cleaned_word.replace(/[\s\"\.!;:\'\(\)]$/, "");
}

function get_unique_words(words) {
  var dictionary = {};
  words.forEach(function(word) {
    word = clean_word(word);
    if (dictionary[word] === undefined) {
      dictionary[word] = 1;
    }
    else {
      dictionary[word] += 1;
    }
  });
  return dictionary;
}

function get_character_count(words) {
  var character_count = 0;
  words.forEach(function(word) {
    word = clean_word(word);
    character_count += word.length;
  });
  return character_count;
}

function calculate_flesch_score(asl, asw) {
  return 206.835 - (1.015 * asl) - (84 * asw);
}

function calculate_kinkaid_grade_level(asl, asw) {
  return (0.39 * asl) + (11.8 * asw) - 15.59;
}

function analyze_text_blob(text_blob, items) {
  var sentences = get_sentences(text_blob);
  var words = get_words(text_blob);
  var unique_words = get_unique_words(words);
  var character_count = get_character_count(words);

  var unique_word_count = Object.keys(unique_words).length;

  var average_sentence_length = words.length / sentences.length;
  var average_syllables_per_word = character_count / words.length / SYL_LEN;
  var flesch_score = calculate_flesch_score(average_sentence_length,
                                            average_syllables_per_word);
  var kinkaid_score = calculate_kinkaid_grade_level(average_sentence_length,
                                            average_syllables_per_word);

  return {
    "word_count": words.length,
    "unique_word_count": unique_word_count,
    "average_item_length": words.length / items,
    "average_sentence_length": average_sentence_length,
    "unique_word_ratio": unique_word_count / words.length,
    "average_word_length": character_count / words.length,
    "flesch_reading_score": flesch_score,
    "kinkaid_grade_score": kinkaid_score
  }
}

function analyze_dialogue(paragraphs) {
  var dialogue_bits = get_dialogue(paragraphs);
  var text_blob = dialogue_bits.join(" ");

  var result = analyze_text_blob(text_blob, dialogue_bits.length);
  result["dialogue_bits"] = dialogue_bits.length;
  return result;
}

function analyze_paragraphs(paragraphs) {
  var text_blob = blob_text(paragraphs.join(" "));
  var scene_count = get_scene_count(paragraphs);
  var words = get_words(text_blob);

  var result = analyze_text_blob(text_blob, paragraphs.length);
  result["paragraph_count"] = paragraphs.length;
  result["scene_count"] = scene_count;
  result["arverage_scene_length"] = result["word_count"] / scene_count;
  return result;
}

function analyze(raw_input) {
  var single_spaced_input = remove_multiple_spaces(raw_input);
  var paragraphs = get_paragraphs(single_spaced_input);
  var paragraph_stats = analyze_paragraphs(paragraphs);
  var dialogue_stats = analyze_dialogue(paragraphs);

  var dialogue_percentage = dialogue_stats["word_count"] /
                            paragraph_stats["word_count"];
  dialogue_stats["dialogue_percentage"] = dialogue_percentage;

  return {
    "paragraph_stats": paragraph_stats,
    "dialogue_stats": dialogue_stats
  }
}

function main(argc, argv) {
  var input_file = argv[2];
  var raw_input = fs.readFileSync(input_file, "utf8");
  var stats = analyze(raw_input);
  console.log(stats);
}

main(process.argv.length, process.argv);

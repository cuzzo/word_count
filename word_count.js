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

  var objs = [];
  tuples.forEach(function(tuple) {
    var obj = {};
    obj[tuple[0]] = tuple[1];
    objs.push(obj);
  });

  return objs;
}

function clean_word(str) {
  return str.toLowerCase()
            .replace(/^[\s"'.,!;:()]/, "")
            .replace(/[\s"'.,!;:()]$/, "");
}

var Blobber = function() {
  function _blob(str) {
    return str.replace(/\s/g, " ")
              .replace(/\s{2,}/g, " ");
  }

  function _remove_multiple_spaces(str) {
    return str.replace(/[ \t]{2,}/g, " ")
              .replace(/\n{2,}/g, "\n");
  };

  function _replace_em_dashes(str) {
    return str.replace("--", " ");
  };

  this.trim = function(str) {
    str = _remove_multiple_spaces(str);
    return str;
  };

  this.blob = function(str) {
    str = _blob(str);
    str = _remove_multiple_spaces(str);
    str = _replace_em_dashes(str);
    return str;
  };
};

var BlobParser = function() {
  this.get_paragraphs = function(text_blob) {
    var raw_paragraphs = text_blob.split("\n");
    var paragraphs = [];
    raw_paragraphs.forEach(function(paragraph) {
      if (!paragraph.match(/[a-zA-Z0-9]/g)) {
        return false;
      }
      paragraphs.push(paragraph);
      return true;
    });
    return paragraphs
  };

  this.get_sentences = function(text_blob) {
    return text_blob.split(/\.[\s"']/g);
  }

  this.get_words = function(text_blob) {
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
  };

  this.get_comma_count = function(text_blob) {
    var commas = text_blob.split(",").length - 1;
    var em_dashes = text_blob.split("--").length - 1;
    var semi_colon_count = text_blob.split(";").length - 1;
    return commas + em_dashes + semi_colon_count;
  };
};

var ParagraphParser = function() {
  this.get_scene_count = function(paragraphs) {
    var scene_count = 0;
    paragraphs.forEach(function(paragraph) {
      if (paragraph[0] !== "\t") {
        scene_count += 1;
      }
    });
    return scene_count;
  };

  this.get_dialogue = function(paragraphs) {
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
  };
};

var Analyzer = function() {
  this.blobber = new Blobber();
  this.blob_parser = new BlobParser();
  this.paragraph_parser = new ParagraphParser();

  this.get_unique_words = function(words) {
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
  };

  this.get_character_count = function(words) {
    var character_count = 0;
    words.forEach(function(word) {
      word = clean_word(word);
      character_count += word.length;
    });
    return character_count;
  };

  this.calculate_flesch_score = function(asl, asw) {
    return 206.835 - (1.015 * asl) - (84 * asw);
  };

  this.calculate_kinkaid_grade_level = function(asl, asw) {
    return (0.39 * asl) + (11.8 * asw) - 15.59;
  };

  this.analyze_text_blob = function(trimmed_text, items) {
    text_blob = this.blobber.blob(trimmed_text);
    var sentences = this.blob_parser.get_sentences(text_blob);
    var words = this.blob_parser.get_words(text_blob);
    var unique_words = this.get_unique_words(words);
    var character_count = this.get_character_count(words);

    var unique_word_count = Object.keys(unique_words).length;

    var average_sentence_length = words.length / sentences.length;
    var average_syllables_per_word = character_count / words.length / SYL_LEN;
    var flesch_score = this.calculate_flesch_score(average_sentence_length,
                                              average_syllables_per_word);
    var kinkaid_score = this.calculate_kinkaid_grade_level(
                                              average_sentence_length,
                                              average_syllables_per_word);

    var commas_per_sentence =
            this.blob_parser.get_comma_count(trimmed_text) / sentences.length;


    return {
      "word_count": words.length,
      "unique_word_count": unique_word_count,
      "average_item_length": words.length / items,
      "commas_per_sentence": commas_per_sentence,
      "average_sentence_length": average_sentence_length,
      "unique_word_ratio": unique_word_count / words.length,
      "average_word_length": character_count / words.length,
      "flesch_reading_score": flesch_score,
      "kinkaid_grade_score": kinkaid_score,
      "unique_words" : sort_dictionary(unique_words)
    }
  };

  this.analyze_dialogue = function(paragraphs) {
    var dialogue_bits = this.paragraph_parser.get_dialogue(paragraphs);
    var dialogue_blob = dialogue_bits.join(" ");

    var result = this.analyze_text_blob(dialogue_blob, dialogue_bits.length);
    result["dialogue_bits"] = dialogue_bits.length;
    return result;
  };

  this.analyze_paragraphs = function(paragraphs) {
    var paragraphs_blob = this.blobber.blob(paragraphs.join(" "));
    var scene_count = this.paragraph_parser.get_scene_count(paragraphs);
    var words = this.blob_parser.get_words(paragraphs_blob);

    var result = this.analyze_text_blob(paragraphs_blob, paragraphs.length);
    result["paragraph_count"] = paragraphs.length;
    result["scene_count"] = scene_count;
    result["arverage_scene_length"] = result["word_count"] / scene_count;
    return result;
  };

  this.analyze = function(raw_text) {
    var text_blob = this.blobber.trim(raw_text);
    var paragraphs = this.blob_parser.get_paragraphs(text_blob);
    var paragraph_stats = this.analyze_paragraphs(paragraphs);
    var dialogue_stats = this.analyze_dialogue(paragraphs);

    var dialogue_percentage = dialogue_stats["word_count"] /
                              paragraph_stats["word_count"];
    dialogue_stats["dialogue_percentage"] = dialogue_percentage;

    return {
      "paragraph_stats": paragraph_stats,
      "dialogue_stats": dialogue_stats
    }
  };
};


function main(argc, argv) {
  var input_file = argv[2];
  var raw_input = fs.readFileSync(input_file, "utf8");
  var analyzer = new Analyzer();
  var stats = analyzer.analyze(raw_input);
  console.log(JSON.stringify(stats, null, 4));
}

main(process.argv.length, process.argv);

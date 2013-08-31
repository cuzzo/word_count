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
  var cleaned_word = str.toLowerCase()
            .replace(/^\s+|\s+$/g, "")
            .replace(/^["'.,!?;:()]*/, "")
            .replace(/["'.,!?;:()]*$/, "");
  if (!cleaned_word.match(/'/g)) {
    return cleaned_word;
  }

  cleaned_word = cleaned_word.replace(/n't/g, " not")
                     .replace(/'d/g, " 'd")
                     .replace(/'ll/g, " will")
                     .replace(/'m/g, " am")
                     .replace(/'re/g, " are")
                     .replace(/'ve/g, " have")
                     .replace(/^let's/, "let us")
                     .replace(/^so's/, "so as");

  var is_regex = /^(he|she|it|how|that|there|what|when|where|who|why)'s/;
  cleaned_word = cleaned_word.replace(is_regex, function(match) {
    if (match.indexOf("'") === -1) {
      return match;
    }
    else {
      return match.split("'")[0] + " is";
    }
  })

  cleaned_word = cleaned_word.replace(/'s/g, " 's");
  return cleaned_word;
}

var Blobber = function() {
  function _blob(str) {
    return str.replace(/\s/g, " ")
              .replace(/\s{2,}/g, " ");
  }

  function _remove_multiple_spaces(str) {
    return str.replace(/[ \t]{2,}/g, " ")
              .replace(/\n{2,}/g, "\n");
  }

  function _replace_em_dashes(str) {
    return str.replace(/--/g, " ");
  }

  this.trim = function(str) {
    str = _remove_multiple_spaces(str);
    return str;
  };

  this.sanitize = function(str) {
    return str.replace(/’(d|ll|m|re|s|t|ve)/g, "'$1")
              .replace(/“/g, "\"")
              .replace(/”/g, "\"")
              //.replace(/‘/g, "\"") nested quotes not yet supported.
              //.replace(/’/g, "\"")
              .replace(/—/g, "--")
              .replace(/–/g, " ")
              .replace(/…/g, ".")
              .replace(/⁈/g, "?!")
              .replace(/⁉/g, "!?")
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
    var raw_sentences = text_blob.split(/\.[\s"']/g);
    var sentences = [];
    raw_sentences.forEach(function(sentence) {
      if (!sentence.match(/[a-zA-Z0-9]/g)) {
        return false;
      }
      sentences.push(sentence);
    });
    return sentences;
  }

  this.tokenize = function(text_blob) {
    raw_words = text_blob.split(" ");
    var words = [];
    raw_words.forEach(function(word) {
      if (!word.match(/[a-zA-Z0-9]/g)) {
        return false;
      }
      var cleaned_word = clean_word(word);
      cleaned_word.split(" ").forEach(function(word) {
        words.push(word);
      });
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

  this.calculate_automated_readability_index = function(chars, words, sents) {
    return 4.71 * (chars / words) + 0.5 * (words / sents) - 21.43;
  };

  this.calculate_coleman_liau_index = function(chars, words, sentences) {
    var w100 = 100 / words;
    return 0.0588 * (w100 * chars) - 0.296 * (w100 * sentences) - 15.8;
  };

  this.analyze_text_blob = function(trimmed_text, items) {
    text_blob = this.blobber.blob(trimmed_text);
    var sentences = this.blob_parser.get_sentences(text_blob);
    var tokens = this.blob_parser.tokenize(text_blob);
    var unique_words = this.get_unique_words(tokens);
    var character_count = this.get_character_count(tokens);

    var unique_word_count = Object.keys(unique_words).length;

    var average_sentence_length = tokens.length / sentences.length;
    var average_syllables_per_word = character_count / tokens.length / SYL_LEN;
    var flesch_score = this.calculate_flesch_score(average_sentence_length,
                                              average_syllables_per_word);
    var kinkaid_score = this.calculate_kinkaid_grade_level(
                                              average_sentence_length,
                                              average_syllables_per_word);
    var automated_readability_index =
        this.calculate_automated_readability_index(character_count,
                                                   tokens.length,
                                                   sentences.length);
    var coleman_liau_index = this.calculate_coleman_liau_index(character_count,
                                                          tokens.length,
                                                          sentences.length);

    var commas_per_sentence =
            this.blob_parser.get_comma_count(trimmed_text) / sentences.length;


    return {
      "word_count": tokens.length,
      "unique_word_count": unique_word_count,
      "average_item_length": tokens.length / items,
      "commas_per_sentence": commas_per_sentence,
      "average_sentence_length": average_sentence_length,
      "unique_word_ratio": unique_word_count / tokens.length,
      "average_word_length": character_count / tokens.length,
      "flesch_reading_score": flesch_score,
      "kinkaid_grade_score": kinkaid_score,
      "automated_readability_index": automated_readability_index,
      "coleman_liau_index": coleman_liau_index,
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

    var result = this.analyze_text_blob(paragraphs_blob, paragraphs.length);
    result["paragraph_count"] = paragraphs.length;
    result["scene_count"] = scene_count;
    result["arverage_scene_length"] = result["word_count"] / scene_count;
    return result;
  };

  this.analyze = function(raw_text) {
    var trimmed_text = this.blobber.trim(raw_text);
    var text_blob = this.blobber.sanitize(trimmed_text);
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

#! /usr/bin/env node

var SYL_LEN = 3; // Constant for average syllable length
var _ = require("underscore");
var wc = require("./wc2");
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


var Analyzer = function() {
  var verbs_of_being = ["is", "are", "was", "were", "be", "being", "been"];
  var thought_verbs = [
    "see", "sees", "saw", "seen",
    "notice", "notices", "noticed",
    "feel", "feels", "felt",
    "hear", "hears", "heard",
    "smell", "smells", "smelled",
    "taste", "tastes", "tasted",
    "sense", "senses", "sensed",
    "think", "thinks", "thought",
    "wonder", "wonders", "wondered",
    "speculate", "speculates", "speculated",
    "question", "questioned", "questions",
    "contemplate", "contemplates", "contemplated",
    "reckon", "reckons", "reckoned",
    "imagine", "imagines", "imagned",
    "assume", "assumes", "assumed",
    "love", "loves", "loved",
    "hate", "hates", "hated"
  ];

  this.get_character_count = function(words) {
    var character_count = 0;
    _.each(words, function(word) {
      character_count += word.length;
    });
    return character_count;
  };

  this.count_verbs_of_being = function(dict) {
    count = 0;
    _.each(_.keys(dict), function(word) {
      if (_.contains(verbs_of_being, word)) {
        count += dict[word];
      }
    });
    return count;
  };

  this.count_thought_verbs = function(dict) {
    count = 0;
    _.each(_.keys(dict), function(word) {
      if (_.contains(thought_verbs, word)) {
        count += dict[word];
      }
    });
    return count;
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

  this.analyze_text_blob = function(sentences, items) {
    var tokens = [];
    _.each(sentences, function(sentence) {
      tokens.push.apply(tokens, sentence);
    });

    var wd = new wc.WordDict();
    _.each(tokens, function(word) {
      wd.add_word(word.toLowerCase(), "NULL");
    });

    var unique_words = wd.get_words();
    var word_count = 0;
    _.each(_.keys(unique_words), function(word) {
      word_count += unique_words[word];
    });

    var character_count = this.get_character_count(tokens);
    var unique_word_count = _.keys(unique_words).length;

    var average_sentence_length = word_count / sentences.length;
    var average_syllables_per_word = character_count / word_count / SYL_LEN;
    var flesch_score = this.calculate_flesch_score(average_sentence_length,
                                              average_syllables_per_word);
    var kinkaid_score = this.calculate_kinkaid_grade_level(
                                              average_sentence_length,
                                              average_syllables_per_word);
    var automated_readability_index =
        this.calculate_automated_readability_index(character_count,
                                                   word_count,
                                                   sentences.length);
    var coleman_liau_index = this.calculate_coleman_liau_index(character_count,
                                                          word_count,
                                                          sentences.length);

    var comma_count = 0;
    _.each(tokens, function(token) {
      if (token === ",") {
        comma_count += 1;
      }
    });

    var commas_per_sentence = comma_count / sentences.length;

    var verbs_of_being = this.count_verbs_of_being(unique_words);
    var thought_verbs = this.count_thought_verbs(unique_words);

    return {
      "word_count": word_count,
      "unique_word_count": unique_word_count,
      "verbs_of_being": verbs_of_being,
      "thought_verbs": thought_verbs,
      "average_item_length": word_count / items,
      "commas_per_sentence": commas_per_sentence,
      "average_sentence_length": average_sentence_length,
      "unique_word_ratio": unique_word_count / word_count,
      "average_word_length": character_count / word_count,
      "flesch_reading_score": flesch_score,
      "kinkaid_grade_score": kinkaid_score,
      "automated_readability_index": automated_readability_index,
      "coleman_liau_index": coleman_liau_index,
      "unique_words" : sort_dictionary(unique_words)
    }
  };

  /*this.analyze_dialogue = function(dialogue_bits) {
    dialogue_b = [];
    var dialogue_bit_count = 0;
    _.each(dialogue_bits, function(dialogue_bit) {
      dialogue_bit_count += 1;
      dialogue_b.push(dialogue_bit);
    });


    var result = this.analyze_text_blob(dialogue_b, dialogue_bit_count);
    result["dialogue_bits"] = dialogue_bit_count;
    return result;
  };*/

  this.analyze_paragraphs = function(scenes) {
    var sentences = [];
    var paragraph_count = 0;
    _.each(scenes, function(scene) {
      _.each(scene, function(paragraph) {
        paragraph_count += 1;
        _.each(paragraph, function(sentence) {
          sentences.push(sentence);
        });
      });
    });

    var result = this.analyze_text_blob(sentences, scenes.length);
    result["paragraph_count"] = paragraph_count;
    result["scene_count"] = scenes.length;
    result["arverage_scene_length"] = result["word_count"] / scenes.length;
    return result;
  };

  this.analyze = function(text_blob) {
    var paragraph_stats = this.analyze_paragraphs(text_blob.scenes);
    return paragraph_stats;

    /*var dialogue_stats = this.analyze_dialogue(text_blob.dialogue_bits);

    var dialogue_percentage = dialogue_stats["word_count"] /
                              paragraph_stats["word_count"];
    dialogue_stats["dialogue_percentage"] = dialogue_percentage;

    return {
      "paragraph_stats": paragraph_stats,
      "dialogue_stats": dialogue_stats
    }*/
  };
};

function main(argc, argv) {
  var sanitizer = new wc.Sanitizer();
  var grouper = new wc.Grouper();

  var input_file = argv[2];
  var raw_input = fs.readFileSync(input_file, "utf8");

  var sanitized_text = sanitizer.sanitize(raw_input);
  var blob = new wc.TextBlob(sanitized_text);

  var analyzer = new Analyzer();
  var stats = analyzer.analyze(blob);
  console.log(JSON.stringify(stats, null, 4));
}

main(process.argv.length, process.argv);

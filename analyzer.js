#! /usr/bin/env node

var SYL_LEN = 3; // Constant for average syllable length
var SNTZD_PRD = "~*.$.$.*~";
var _ = require("underscore");
var natural = require("natural");
var pos = require("pos");

var Tagger = function() {
  var tagger = new pos.Tagger();

  this.tag = function(words) {
    words = _.map(words, function(word) {
      if (word[0] === "'") {
        switch (word) {
          case "'re": return "are";
          case "'s": return "has";
          case "'ll": return "will";
          case "'ve": return "have";
          case "'d": return "would";
          case "'m": return "am";
        };
      }
      if (word === "n't") {
        return "not";
      }
      return word;
    });
    return tagger.tag(words);
  };
};

var Sanitizer = function() {
  titles = [
    "Col",
    "Comdr",
    "Corp",
    "Cpl",
    "Dcn",
    "Dn",
    "Dr",
    "Fr",
    "Ft",
    "Lt",
    "Mr",
    "Mrs",
    "Ms",
    "Msgr",
    "Prof",
    "Rev",
    "Sgt",
    "SS",
  ];

  regexes = [
    /a\.?d\./ig, // A.D.
    /a\.?m\./ig, // a.m.
    /apt\./ig, // apt.
    /ave\./ig, // ave.
    /b\.?a\./ig, // B.A.
    /b\.?c\./ig, // B.C.
    /b\.?c\.?e\./ig, // B.C.E
    /blvd\./ig, // blvd.
    /b\.?s\./ig, // B.S.
    /capt\./ig, // Capt.
    /c\.?e\./ig, // C.E.
    /col\./ig, // Col.
    /comdr\./ig, // Comdr.
    /corp\./ig, // Corp.
    /cpl\./ig, // Cpl.
    /ct\./ig, // ct.
    /ctr\./ig, // ctr.
    /d\.?c\./ig, // D.C.
    /dcn\./ig, // Dcn.
    /dn\./ig, // Dn.
    /dr\./ig, // Dr. || dr.
    /e\.?g\./ig, // e.g.
    /et\.? al\./ig, // et al.
    /etc\./ig, // etc.
    /fr\,/ig, // Fr.
    /ft\./ig, // Ft.
    /i\.?e\./ig, // i.e.
    /inc\./ig, // inc.
    /jr\./ig, // Jr.
    /ln\./ig, // ln.
    /lt\./ig, // Lt.
    /ltd\./ig, // Ltd.
    /no\./ig, // no.
    /m\.?\d./ig, // M.D.
    /mr\./ig, // Mr.
    /mrs\./ig, // Mrs.
    /ms\./ig, // Ms.
    /msgr\./ig, // Msgr.
    /p\.?m\./ig, // p.m.
    /ph\.? ?d\./ig, // Ph.D.
    /prof\./ig, // Prof.
    /rd\./ig, // rd.
    /rev\./ig, // Rev.
    /sgt\./ig, // Sgt.
    /sr\./ig, // Sr.
    /s\.?s\./ig, // S.S.
    /st\./ig, // St. || st.
    /ste\./ig, // ste.
    /uninc\./ig, // uninc.
    /vs\./ig, // vs.
  ];

  this.get_next_word = function(str) {
    var next_word = str.trimLeft().search(" ");
    if (next_word === -1) {
      return str;
    }
    return str.trimLeft().substring(0, next_word);
  };

  this.should_punctuate = function(word, next_word) {
    word = word.replace(/[!?.,"'()#]*$/, "");
    if (_.contains(titles, word)) {
      return false;
    }

    var tokens = tokenizer.tokenize(next_word);
    var token = tokens[0].replace(/[!?.,"'()#]*$/, "");
    var tagged_word = tagger.tag([token])[0];
    if (!_.contains(["NNP", "NNPS"], tagged_word[1])) {
      return true;
    }
    return false;
  };

  this.sub = function(str, regex, pos) {
    var start_string = str.substring(0, pos);
    var end_string = str.substring(pos);
    var word = this.get_next_word(end_string);
    end_string = end_string.substring(word.length);
    word = word.replace(".", "");
    if (!end_string) {
      return start_string + word + SNTZD_PRD;
    }

    var next_word = this.get_next_word(end_string).trimLeft();
    if (next_word && next_word[0].match(/[A-Z]/)) {
      if (this.should_punctuate(word, next_word)) {
        word += SNTZD_PRD;
      }
    }
    return start_string + word + end_string;
  };

  this.replace_em_dashes = function(str) {
    return str.replace(/--/g, ", ");
  };

  this.remove_duplicate_punctuation = function(str) {
    return str.replace(/\.{3}/g, ".")
              .replace(/\.+/g, ".")
              .replace(/!+/g, "!")
              .replace(/\?+/g, "?");
  };

  this.switch_exclamitory_question_punctuation_order = function(str) {
    return str.replace(/\?!/g, "!?");
  };

  this.switch_quote_punctuation_order = function(str) {
    var regexp = /(?:[.!?]+)\"/g;
    while ((match = regexp.exec(str)) !== null) {
      var term = match[0];
      var term = "\"" + term.substring(0, term.length - 1);
      var start = str.substring(0, match["index"]);
      var end = str.substring(match["index"] + term.length);
      str = start + term + end;
    }
    return str;
  };

  this.replace_abbreviations = function(str) {
    _.each(regexes, function(regex) {
      var pos = -1;
      while ((pos = str.search(regex)) !== -1) {
        str = this.sub(str, regex, pos);
      }
    }, this);
    return str;
  };

  this.sanitize = function(text) {
    text = this.replace_em_dashes(text);
    text = this.remove_duplicate_punctuation(text);
    text = this.switch_exclamitory_question_punctuation_order(text);
    text = this.switch_quote_punctuation_order(text);
    text = this.replace_abbreviations(text);
    return text.replace(SNTZD_PRD, ".");
  };
}

var TextBlob = function() {
  this.scenes = [];
  this.dialogue_bits = [];
  this._words = undefined;
  this._dialogue_words = undefined;

  this.add_scene = function(paragraph) {
    if (paragraph.length <= 0) {
      return false;
    }
    this.scenes.push(paragraph);
    return true;
  };

  this.add_dialogue = function(dialogue) {
    if (dialogue.length <= 0) {
      return false;
    }
    this.dialogue_bits.push(dialogue);
    return true;
  };

  this.extract_dialogue = function(text) {
    var begin_quote = -1;
    while ((begin_quote = text.search("\"")) !== -1) {
      var quote_text = text.substring(begin_quote + 1);
      var end_quote = quote_text.search("\"");
      if (end_quote === -1) {
        break;
      }
      var quote_text = quote_text.substring(0, end_quote);
      var tokens = tokenizer.tokenize(quote_text);
      this.add_dialogue(tokens);
      text = quote_text.substring(end_quote + 1);
    }
  };

  this._parse_sentence = function(sentence, terminator) {
    sentence = sentence.trimLeft();
    // Scene break...
    if (sentence.search(/[a-zA-Z]/) === -1 &&
        sentence.search(/[-=~_#*]/) !== -1) {
      return [];
    }
    var tokens = tokenizer.tokenize(sentence);
    tokens.push(terminator);
    return tokens;
  };

  this.parse = function(text) {
    this.extract_dialogue(text);

    var paragraphs = text.split("\n");
    var current_p = [];
    _.each(paragraphs, function(paragraph) {
      if (!paragraph.match(/^[ \t]/)) {
        this.add_scene(current_p);
        current_p = [];
      }
      var sentences = [];
      var regexp = /(?:[.!?]+)/g;
      while ((match = regexp.exec(paragraph)) !== null) {
        var term = match[0];
        var sentence = paragraph.substring(0, match["index"]);
        var tokens = tokenizer.tokenize(sentence);
        tokens.push(term);
        sentences.push(tokens);
        paragraph = paragraph.substring(match["index"] + term.length);
      }
      current_p.push(sentences);
    }, this);
    this.add_scene(current_p);
  };

  this.clean_word = function(str) {
    return str.toLowerCase()
              .replace(/^[\s"'.,!;:()]/, "")
              .replace(/[\s"'.,!;:()]$/, "");
  };

  this.get_sentences = function() {
    var sentences = [];
    _.each(this.scenes, function(scene) {
      _.each(scene, function(paragraph) {
        _.each(paragraph, function(sentence) {
          sentences.push(sentence);
        }, this);
      }, this);
    }, this);
    return sentences;
  };

  this._get_words_from_token_lists = function(token_lists) {
    var words = [];
    _.each(token_lists, function(token_list) {
      _.each(token_list, function(token) {
        var word = this.clean_word(token);
        if (word.length <= 0) {
          return;
        }
        words.push(word);
      }, this);
    }, this);
    return words;
  };

  this.get_words = function() {
    if (this._words !== undefined) {
      return this._words;
    }
    var words = this._get_words_from_token_lists(this.get_sentences());
    return this._words = words;
  };

  this.get_dialogue_words = function() {
    if (this._dialogue_words !== undefined) {
      return this._dialogue_words;
    }
    var words = this._get_words_from_token_lists(this.dialogue_bits);
    return this._dialogue_words = words;
  };

  this._get_word_dict = function(words) {
    word_dict = new WordDict();
    var tagged_words = tagger.tag(words);
    _.each(tagged_words, function(tagged_word) {
      var word = tagged_word[0].toLowerCase();
      var pos = tagged_word[1];
      word_dict.add_word(word, pos);
    });
    return word_dict;
  };

  this.build_word_dict = function() {
    return this._get_word_dict(this.get_words());
  };

  this.build_dialogue_word_dict = function() {
    return this._get_word_dict(this.get_dialogue_words());
  };
};

var WordDict = function() {
  var punc_regex = /^[.!?,;:"]+$/;

  this.dicts = {};

  this.is_word = function(word) {
    if (punc_regex.exec(word)) {
      return false;
    }
    return true;
  };

  this.add_word = function(word, pos) {
    // SPECIAL CASE FOR -LY ADVERBS.
    if (pos === "RB") {
      if (word.indexOf("ly", word.length - 2) !== -1) {
        pos = "LY";
      }
    }

    if (!(pos in this.dicts)) {
      this.dicts[pos] = {};
    }
    if (!(word in this.dicts[pos])) {
      this.dicts[pos][word] = 0;
    }
    this.dicts[pos][word] += 1;
  };

  this.get_pos_totals = function() {
    var totals = {};
    _.each(this.dicts, function(dict, pos) {
      totals[pos] = _.reduce(dict, function(memo, num) {
        return memo + num;
      }, 0);
    });
    return totals;
  };

  this._get_pos = function(pos_list) {
    var words = {};
    _.each(pos_list, function(pos) {
      _.each(this.dicts[pos], function(count, word) {
        words[word] = count;
      }, this);
    }, this);
    return words;
  };

  this.get_words = function() {
    var words = {};
    _.each(this.dicts, function(dict) {
      _.each(dict, function(count, word) {
        if (!this.is_word(word)) {
          return;
        }
        words[word] = count;
      }, this);
    }, this);
    return words;
  };
};

var Grouper = function() {
  var conjunctions = ["CC"];
  var prepositions = ["IN", "TO", "RP"];
  var adjectives = ["JJ", "JJR", "JJS", "RBR", "RBS"];
  var nouns = ["NN", "NNS"];
  var proper_nouns = ["NNP", "NNPS"];
  var pronouns = ["PRP$", "PRP", "WP"];
  var adverbs = ["RB"];
  var verbs = ["VB", "VBD", "VBG", "VBN", "VBT", "VBZ"];

  this.group = function(totals) {
    var grouped_totals = {
      "CC": 0, // Conjuction
      "IN": 0, // Prep
      "JJ": 0, // Adjective
      "NN": 0, // Noun
      "PN": 0, // Proper Noun
      "WP": 0, // Pronoun
      "RB": 0, // Adverb
      "VB": 0 // Verb
    };

    _.each(totals, function(count, pos) {
      if (this.is_conjunction(pos)) {
        grouped_totals["CC"] += count;
      }
      else if (this.is_preposition(pos)) {
        grouped_totals["IN"] += count;
      }
      else if (this.is_adjective(pos)) {
        grouped_totals["JJ"] += count;
      }
      else if (this.is_noun(pos)) {
        grouped_totals["NN"] += count;
      }
      else if (this.is_proper_noun(pos)) {
        grouped_totals["PN"] += count;
      }
      else if (this.is_pronoun(pos)) {
        grouped_totals["WP"] += count;
      }
      else if (this.is_adverb(pos)) {
        grouped_totals["RB"] += count;
      }
      else if (this.is_verb(pos)) {
        grouped_totals["VB"] += count;
      }
      else {
        grouped_totals[pos] = count;
      }
    });
    return grouped_totals;
  };

  this.is_conjunction = function(pos) {
    return _.contains(conjunctions, pos);
  };

  this.is_preposition = function(pos) {
    return _.contains(prepositions, pos);
  };

  this.is_adjective = function(pos) {
    return _.contains(adjectives, pos);
  };

  this.is_noun = function(pos) {
    return _.contains(nouns, pos);
  };

  this.is_proper_noun = function(pos) {
    _.contains(proper_nouns, pos);
  };

  this.is_pronoun = function(pos) {
    return _.contains(pronouns, pos);
  };

  this.is_adverb = function(pos) {
    return _.contains(adverbs, pos);
  };

  this.is_verb = function(pos) {
    return _.contains(verbs, pos);
  };

  this.is_any_noun = function(pos) {
    return this.is_noun(pos)
        || this.is_proper_noun(pos)
        || this.is_pronoun(pos);
  };

  this.get_conjunctions = function(wd) {
    return wd._get_pos(conjunctions);
  };

  this.get_prepositions = function(wd) {
    return wd._get_pos(prepositions);
  };

  this.get_adjectives = function(wd) {
    return wd._get_pos(adjectives);
  };

  this.get_nouns = function(wd) {
    return wd._get_pos(nouns);
  };

  this.get_proper_nouns = function(wd) {
    return wd._get_pos(proper_nouns);
  };

  this.get_pronouns = function(wd) {
    return wd._get_pos(pronouns);
  };

  this.get_adverbs = function(wd) {
    return wd._get_pos(adverbs);
  };

  this.get_ly_adverbs = function(wd) {
    return wd._get_pos(["LY"]);
  };

  this.get_verbs = function(wd) {
    return wd._get_pos(verbs);
  };

  var pos_groupers = [
    this.is_conjunction,
    this.is_preposition,
    this.is_adjective,
    this.is_adverb,
    this.is_any_noun,
    this.is_verb
  ];

  this.pos_fuzzy_match = function(pos_a, pos_b) {
    if (pos_a === pos_b) {
      return true;
    }
    _.each(pos_groupers, function(is_of_pos) {
      if (is_of_pos.call(this, pos_a) && is_of_pos.call(this, pos_b)) {
        return true;
      }
    }, this);
    return false;
  };
}

function get_unique_words(wd) {
  var non_words = [
    "POS",
    "SYM",
    ",",
    ".",
    ":",
    "$",
    "#",
    "\"",
    "(",
    ")"
  ];
  var total = 0;

  _.each(wd.dicts["NNS"], function(count, word) {
    //console.log(word);
  });

  _.each(wd.dicts, function(dict, pos) {
    if (_.contains(non_words, pos)) {
      return false;
    }
    total += _.keys(dict).length;
  });
  return total;
}

var Analyzer = function() {
  this.retag = function(word, pos) {
    return pos;
  };

  this.get_word_dict = function(tagged_words) {
    word_dict = new WordDict();
    _.each(tagged_words, function(tagged_word) {
      var word = tagged_word[0].toLowerCase();
      var pos = tagged_word[1];
      word_dict.add_word(word, pos);
    });
    return word_dict;
  };

  this.get_negatives = function(words) {

  };

  this.score_sentence = function(tagged_words) {
    var density = 0;
    var weakness = 0;
    var complexity = 0;
    var negativity = 0;

    wd = this.get_word_dict(tagged_words);
    var words = wd.get_words();
    var nouns = grouper.get_nouns(wd);
    var pronouns = grouper.get_pronouns(wd);
    var proper_nouns = grouper.get_proper_nouns(wd);
    var verbs = grouper.get_verbs(wd);
    var adjectives = grouper.get_adjectives(wd);
    var prepositions = grouper.get_prepositions(wd);
    var conjunctions = grouper.get_conjunctions(wd);
    var adverbs = grouper.get_adverbs(wd);
    var ly_adverbs = grouper.get_ly_adverbs(wd);

    density += tagged_words.length;
    density += _.keys(adverbs).length
             + _.keys(ly_adverbs).length
             + _.keys(adjectives).length;

    weakness += _.keys(ly_adverbs).length * 2;

    complexity += _.keys(conjunctions).length + _.keys(prepositions).length;
    complexity += _.keys(verbs).length;

    negativity += words["not"] ? words["not"] : 0;

    return {
      "complexity": complexity,
      "density": density,
      "weakness": weakness,
      "negativity": negativity
    };
  };

  this.analyze_sentence = function(sentence) {
    var tagged_words = tagger.tag(sentence);
    console.log(sentence.join(" "));
    console.log(this.score_sentence(tagged_words));
  };

  this.analyze = function(blob) {
    var sentences = blob.get_sentences();
    _.each(sentences, this.analyze_sentence, this);
  };
}

var stemmer = natural.LancasterStemmer;
var tokenizer = new natural.TreebankWordTokenizer();
var wordnet = new natural.WordNet();
var lexer = new pos.Lexer();
var tagger = new Tagger();

// Convert single quote to apostrophe.
// Deal with em-dashes.
/*var text = "Boy!!!  Do you like eggs?! Because I sure do.\n"
         + "    \"This should be enough.\"\n"
         + "    Orders were given.\n"
         + "    I like to swim... And I think you're dumb, and I don't like you--which is why I'm ignoring you.\n"
         + "    I thought: that's stupid.\n"
         + "    Go to the store; go to hell.\n";
         + "The end.";*/
var text = "Quickly, this is becomming more involved than I thought, and it's really killing my ability to work on my novel, ironically.\n"
+ "    It's not like I wasn't tired.";

var sanitizer = new Sanitizer();
var grouper = new Grouper();
var analyzer = new Analyzer();

var sanitized_text = sanitizer.sanitize(text);
var blob = new TextBlob();
blob.parse(sanitized_text);
var wd = blob.build_word_dict();
console.log(wd.dicts);
/*analyzer.analyze(blob);*/

//console.log(tagger.tag(["whichever"]));

/*var wd = blob.build_word_dict();
var totals = wd.get_pos_totals();
var grouped_totals = grouper.group(totals);
console.log(grouped_totals);

var dwd = blob.build_dialogue_word_dict();
var totals = dwd.get_pos_totals();
var grouped_totals = grouper.group(totals);
console.log(grouped_totals);

var unique_words = get_unique_words(wd);
console.log(unique_words, sentence.split(" ").length);*/

/*
var tokens = ["unimpressed"];
tokens.forEach(function(token) {
  wordnet.lookup(token, function(results) {
    results.forEach(function(result) {
      console.log(result);
    });
  });
});
*/

function is_negative(word, prefix) {
  var re = new RegExp("^" + prefix);
  word = word.replace(re, "");
  var is_negative = false;
  wordnet.lookup(word, function(results) {
    console.log(results);
    is_negative = results.length === 0 ? true : false;
    return;
  });
  return is_negative;
}

var Cliche = function(str) {
  this.get_series = function(str) {
    var series = [];
    var tokens = str.replace(/\s+/g, " ").trim().split(" ");
    _.each(tokens, function(token) {
      var token = token.split("/");
      var word = token[0];
      var command = "";
      if (token.length > 1) {
        command = token[1];
      }

      switch (command) {
        case "s":
          var tag = tagger.tag([word]);
          series.push([tag[0][1], [tag[0][0]]]); // push syns of tag[0][0].
          break;
        case "p":
          var tag = tagger.tag([word]);
          series.push([tag[0][1], []]);
          break;
        case "e":
        default:
          var tag = tagger.tag([word]);
          series.push([tag[0][1], [tag[0][0]]]);
      }
    }, this);
    return series;
  };

  this.str = str;
  this.series = this.get_series(str);
};

var ClicheHunter = function() {
  this.synonyms = {};
  this.cliches = [];

  this.add_cliche = function(str) {
    var cliche = new Cliche(str);
    this.cliches.push(cliche);
  };

  this._hunt_noise = function(tag, part, tagged_sentence) {
    var noise = [];
    while ((grouper.is_adjective(tag[1]) &&
           !grouper.is_adjective(part[0])) ||
           (grouper.is_adverb(tag[1]) &&
           !grouper.is_adverb(part[0]))) {

      var next_tag = tagged_sentence.shift();
      if (!next_tag) {
        return noise;
      }
      noise.push(tag);
      tag = next_tag;
    }
    return noise;
  };

  this._hunt = function(tagged_sentence) {
    var matches = [];
    _.each(this.cliches, function(cliche) {
      var ts = tagged_sentence.slice();

      while (ts.length > 0) {
        var match_words = [];
        var tag = ts.shift();
        var series = cliche.series.slice();
        while (series.length > 0) {
          var part = series.shift();

          var noise = this._hunt_noise(tag, part, ts.slice());
          _.each(noise, function(n) {
            match_words.push(n[0]);
            tag = ts.shift();
          });

          if (!grouper.pos_fuzzy_match(part[0], tag[1])) {
            break;
          }

          match_words.push(tag[0]);
          tag = ts.shift();
          if (series.length <= 0) {
            matches.push([match_words, cliche]);
            break;
          }
        }
      }
    }, this);
    return matches;
  };

  this.hunt = function(blob) {
    _.each(blob.get_sentences(), function(sentence) {
      var text = tagger.tag(sentence);
      var cliches_in_sentence = this._hunt(text);
    }, this);
  };
};

function get_synonyms(word, pos, callback) {
  wordnet.lookup(word, function(results) {
    var possible_synonyms = [];
    _.each(results, function(result) {
      if (result["pos"] !== pos) {
        return false;
      }
      _.each(result["synonyms"], function(synonym) {
        if (synonym === word) {
          return false;
        };
        if (_.contains(possible_synonyms, synonym)) {
          return false;
        }
        possible_synonyms.push(synonym);
      });
    });
    callback(word, pos, possible_synonyms);
  });
}

/*get_synonyms("disturb", "v", function(word, pos, possible_synonyms) {
  console.log(possible_synonyms);
});*/

ch = new ClicheHunter();
ch.add_cliche("small/s world/s.");
ch.add_cliche("in/p the/p palm/s of/p its/p hand/s");

var cliche_text = "Some starter text.  Pluton really was a small beautiful world that had me in the palm of its hand.";
var sanitized_text = sanitizer.sanitize(cliche_text);
var blob = new TextBlob();
blob.parse(sanitized_text);

ch.hunt(blob);

#! /usr/bin/env node

var SYL_LEN = 3; // Constant for average syllable length
var SNTZD_PRD = "_))-((_";
var _ = require("underscore");
var natural = require("natural");
var pos = require("pos");
var fs = require("fs");

var Tagger = function() {
  var tagger = new pos.Tagger();

  this.tag = function(words) {
    return tagger.tag(words);
  };
};

var Tokenizer = function() {
  this.tokenize = function(text) {
    // Non-standard / slang contractions.
    var text = text.replace(/\bt'?is\b/ig, "it is")
                   .replace(/\bt'?was\b/ig, "it was")
                   .replace(/\bain'?t\b/ig, "are not")
                   .replace(/\bcannot\b/ig, "can not")
                   .replace(/\bc'?mon\b/ig, "come on")
                   .replace(/\bgimme\b/ig, "give me")
                   .replace(/\bgonna\b/ig, "going to")
                   .replace(/\bgotta\b/ig, "have to")
                   .replace(/\blemme\b/ig, "let me")
                   .replace(/\bmor'n\b/ig, "more than")
                   .replace(/\bwanna\b/ig, "want to")
                   .replace(/\bwhat?'?cha\b/ig, "what do you")
                   .replace(/\byes'm\b/ig, "yes ma'am")
                   .replace(/\bi'm\b/ig, "I am")
                   .replace(/\bso's\b/ig, "so as")
                   .replace(/\blet's\b/ig, "let us")
                   .replace(/\bwon't\b/ig, "will not");

    // Standard easily replacable contractions
    text = text.replace(/(.)'ve\b/ig, "$1 have") // have first; can commpound
               .replace(/(.)n't\b/ig, "$1 not") // not second; can compound
               .replace(/(.)'d\b/g, " 'd")
               .replace(/'ll/g, " will")
               .replace(/'re/g, " are");


    // Is contractions.
    var is_regex = /\b(he|she|it|how|that|there|what|when|where|who|why)'s\b/ig;
    text = text.replace(is_regex, "$1 is");

    // Most punctuation.
    text = text.replace(/([^\w\.\'\-\/\+\<\>,&])/g, " $1 ");

    // Commas if followed by space.
    text = text.replace(/(,\s)/g, " $1");

    // Single quotes if followed by a space
    text = text.replace(/('\s)/g, " $1");

    // Periods before newline or end of string
    text = text.replace(/\. *(\n|$)/g, " . ");

    return  _.without(text.split(/\s+/), '');
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
    /\d*\.\d+/ig, // Decimals
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
    /mt\./ig, // Mt.
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

  var tokenizer = new Tokenizer();
  var tagger = new pos.Tagger();

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
    var token = tokens[0].replace(/[!?.,"'()#]+$/, "");
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

  this.replace_fancy_punctuation = function(str) {
    return str.replace(/’(d|ll|m|re|s|t|ve)/g, "'$1")
              .replace(/“/g, "\"")
              .replace(/”/g, "\"")
              //.replace(/‘/g, "\"") nested quotes not yet supported.
              //.replace(/’/g, "\"")
              .replace(/⁈/g, "?!")
              .replace(/⁉/g, "!?")
              .replace(/…/g, ".");
  };

  this.replace_em_dashes = function(str) {
    return str.replace(/--/g, ", ")
              .replace(/—/g, ", ");
  };

  this.replace_en_dashes = function(str) {
    return str.replace(/–/g, " ");
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

  this.replace_time = function(str) {
    var regexp = /\d{1,2}:\d{1,2}/g;
    while ((match = regexp.exec(str)) !== null) {
      var time = match[0];
      var start = str.substring(0, match["index"]);
      var end = str.substring(match["index"] + time.length);
      str = start + time.replace(":", "-") + end;
    }
    return str;
  };

  this.sanitize = function(raw_text) {
    var lines = _.map(raw_text.split("\n"), function(line) {
      line = this.replace_time(line);
      line = this.replace_fancy_punctuation(line);
      line = this.replace_em_dashes(line);
      line = this.replace_en_dashes(line);
      line = this.remove_duplicate_punctuation(line);
      line = this.switch_exclamitory_question_punctuation_order(line);
      //line = this.switch_quote_punctuation_order(line);
      line = this.replace_abbreviations(line);
      return line.replace(SNTZD_PRD, ".");
    }, this);
    return lines.join("\n");
  };
}

var TextBlob = function(text) {
  this.scenes = [];
  this.dialogue_bits = [];
  this._words = [];
  this._dialogue_words = [];

  var tokenizer = new Tokenizer();
  var tagger = new Tagger();

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
      text = text.substring(begin_quote + end_quote + 2);
    }
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
              .replace(/^[\s".,!?;:()]*/, "")
              .replace(/[\s".,!?;:()]*$/, "");
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
    if (this._words.length > 0) {
      return this._words;
    }
    var words = this._get_words_from_token_lists(this.get_sentences());
    return this._words = words;
  };

  this.get_dialogue_words = function() {
    if (this._dialogue_words.length > 0) {
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

  this.parse(text);
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


function main(argc, argv) {
  var sanitizer = new Sanitizer();
  var grouper = new Grouper();

  var input_file = argv[2];
  var raw_input = fs.readFileSync(input_file, "utf8");

  var sanitized_text = sanitizer.sanitize(raw_input);
  var blob = new TextBlob(sanitized_text);

  var wd = blob.build_word_dict();
  console.log(wd.dicts);
}

main(process.argv.length, process.argv);

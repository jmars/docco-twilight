(function() {
  var destination, docco_styles, docco_template, ensure_directory, exec, ext, files, findit, fs, generate, generate_documentation, generate_html, get_language, highlight, highlight_end, highlight_start, l, languages, parse, path, settings, showdown, source_file, spawn, targets, template, _ref;
  generate_documentation = function(source, callback) {
    return fs.readFile(source, "utf-8", function(error, code) {
      var sections;
      if (error) {
        throw error;
      }
      sections = parse(source, code);
      return highlight(source, sections, function() {
        generate_html(source, sections);
        return callback();
      });
    });
  };
  parse = function(source, code) {
    var code_text, docs_text, has_code, language, line, lines, save, sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = get_language(source);
    has_code = docs_text = code_text = '';
    save = function(docs, code) {
      return sections.push({
        docs_text: docs,
        code_text: code
      });
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
        if (has_code) {
          save(docs_text, code_text);
          has_code = docs_text = code_text = '';
        }
        docs_text += line.replace(language.comment_matcher, '') + '\n';
      } else {
        has_code = true;
        code_text += line + '\n';
      }
    }
    save(docs_text, code_text);
    return sections;
  };
  highlight = function(source, sections, callback) {
    var language, output, pygments, section;
    language = get_language(source);
    pygments = spawn('pygmentize', ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8']);
    output = '';
    pygments.stderr.addListener('data', function(error) {
      if (error) {
        return console.error(error);
      }
    });
    pygments.stdout.addListener('data', function(result) {
      if (result) {
        return output += result;
      }
    });
    pygments.addListener('exit', function() {
      var fragments, i, section, _len;
      output = output.replace(highlight_start, '').replace(highlight_end, '');
      fragments = output.split(language.divider_html);
      for (i = 0, _len = sections.length; i < _len; i++) {
        section = sections[i];
        section.code_html = highlight_start + fragments[i] + highlight_end;
        section.docs_html = showdown.makeHtml(section.docs_text);
      }
      return callback();
    });
    pygments.stdin.write(((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.code_text);
      }
      return _results;
    })()).join(language.divider_text));
    return pygments.stdin.end();
  };
  generate_html = function(source, sections) {
    var title;
    title = path.basename(source);
    return destination(source, function(dest, depth) {
      var html;
      html = docco_template({
        title: title,
        sections: sections,
        sources: files,
        path: path,
        source_file: source_file,
        depth: depth
      });
      console.log("docco: " + source + " -> " + dest);
      return fs.writeFile(dest, html);
    });
  };
  fs = require('fs');
  path = require('path');
  findit = require('findit');
  showdown = require('./../vendor/showdown').Showdown;
  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;
  languages = {
    '.coffee': {
      name: 'coffee-script',
      symbol: '#'
    },
    '.js': {
      name: 'javascript',
      symbol: '//'
    },
    '.rb': {
      name: 'ruby',
      symbol: '#'
    },
    '.py': {
      name: 'python',
      symbol: '#'
    },
    '.h': {
      name: 'objc',
      symbol: '//'
    },
    '.hs': {
      name: 'haskell',
      symbol: '--'
    },
    '.as': {
      name: 'actionscript',
      symbol: '//'
    }
  };
  for (ext in languages) {
    l = languages[ext];
    l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');
    l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{)');
    l.divider_text = '\n' + l.symbol + 'DIVIDER\n';
    l.divider_html = new RegExp('\\n*<span class="c1?">' + l.symbol + 'DIVIDER<\\/span>\\n*');
  }
  get_language = function(source) {
    return languages[path.extname(source)];
  };
  destination = function(filepath, callback) {
    var dest, dirs;
    dirs = path.dirname(filepath).split('/');
    dest = 'docs/';
    if (settings.dirs) {
      dest += dirs.slice(1).join('/') + '/';
    }
    return ensure_directory(dest, function() {
      dest += path.basename(filepath, path.extname(filepath)) + '.html';
      return callback(dest, dirs.length);
    });
  };
  source_file = function(depth, filepath) {
    var dest, dirs;
    dirs = path.dirname(filepath).split('/');
    dest = '';
    if (settings.dirs) {
      dest += new Array(depth).join('../') + dirs.slice(1).join('/') + '/';
    }
    dest += path.basename(filepath, path.extname(filepath)) + '.html';
    return dest;
  };
  ensure_directory = function(dir, callback) {
    return exec('mkdir -p ' + dir, function() {
      return callback();
    });
  };
  template = function(str) {
    return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};' + 'with(obj){p.push(\'' + str.replace(/[\r\t\n]/g, " ").replace(/'(?=[^<]*%>)/g, "\t").split("'").join("\\'").split("\t").join("'").replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');").split('%>').join("p.push('") + "');}return p.join('');");
  };
  docco_template = template(fs.readFileSync(__dirname + '/../resources/docco.jst').toString());
  docco_styles = fs.readFileSync(__dirname + '/../resources/docco.css').toString();
  highlight_start = '<div class="highlight"><pre>';
  highlight_end = '</pre></div>';
  targets = [];
  files = [];
  settings = {};
  generate = this.generate = function(targets, options) {
    if (targets.length) {
      return ensure_directory('docs', function() {
        var generate_next, next_target, x;
        fs.writeFile('docs/docco.css', docco_styles);
        targets = targets;
        settings = options;
        x = 0;
        generate_next = function() {
          var file;
          file = files[++x];
          if (!!file) {
            return generate_documentation(file, generate_next);
          }
        };
        next_target = function() {
          var search, target;
          target = targets.shift();
          if (!target) {
            return generate_next();
          }
          search = findit.findSync(target);
          files = files.concat(search.filter(function(file) {
            return fs.statSync(file).isFile() && get_language(path.basename(file));
          }));
          return next_target();
        };
        return next_target();
      });
    }
  };
}).call(this);

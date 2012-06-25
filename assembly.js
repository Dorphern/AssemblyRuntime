CodeMirror.defineMode('assembly', function(conf) {

	function wordRegexp(words) {
        return new RegExp("^((" + words.join(")|(") + "))\\b");
    }

	var keywords = wordRegexp( ['SET', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'IFE', 'IFN', 'IFG', 'JST'] );

	var wordOperators = wordRegexp( ['PUSH', 'POP', 'PEEK'] );

	//Register variables
	var variable = new RegExp("^[A-Z]");

	var label = new RegExp("^:?[a-z\_\-]{2,}");

	var singleLineComment = ";";

	function tokenBase(stream, state) {
		//if (stream.eatSpace()) return null;

		var ch = stream.peek();

		//console.log(ch);
		if (ch == singleLineComment) {
			stream.skipToEnd();
			return 'comment';
		}

		if (stream.match(/^-?[0-9]+/, false)) return 'number';

		if (stream.match(keywords)) return 'keyword';

		if (stream.match(wordOperators)) return 'operator';

		if (ch.match(variable)) return 'variable';

		return null;
	}

	return {
		startState: function() {
			return {
				lastToken: null
			};
		},

		token: function(stream, state) {
			var style = tokenBase(stream, state);

			stream.next();
			return style;
		}

	};

});
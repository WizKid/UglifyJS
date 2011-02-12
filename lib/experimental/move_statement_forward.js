util = require("util");

function find_first_execute(node) {
		if (!node)
				return false;

		switch (node[0]) {
				case "num":
				case "string":
				case "name":
						return node;

				case "call":
				case "conditional":
				case "for":
				case "if":
				case "new":
				case "return":
				case "seq":
				case "stat":
				case "switch":
				case "throw":
						return find_first_execute(node[1]);

				case "binary":
						return find_first_execute(node[2]);

				case "assign":
						// If the left side of the assignment isn't a name we can't
						// move stuff to the right side because the left side
						// is executed before the right side
						if (node[2][0] != "name")
								return null;

						return find_first_execute(node[3]);

				case "var":
						if (node[1][0].length > 1)
								return find_first_execute(node[1][0][1]);

						break;
		}

		return null;
}

function return_values(node) {
		switch (node[0]) {
				case "stat":
						return return_values(node[1]);

				case "num":
				case "string":
				case "name":
						return [node];

				case "assign":
						var a = [node[2]]
						if (node[1] === true && node[2][0] == "name")
								a.push.apply(a, return_values(node[3]));

						return a

				case "unary-prefix":
						if (node[1] == "--" || node[1] == "++")
								return [node[2]];
						break;
		}

		return [];
}

function compare_array(a1, a2) {
		if (a1.length != a2.length) return false;

		for (var i = 0; i < a1.length; i++)
				if (a1[i] != a2[i]) return false;

		return true;
}

function make_seq_to_statements(node) {
		if (node[0] != "seq") {
				switch (node[0]) {
						case "var":
						case "const":
								return [ node ];
						default:
								return [ [ "stat", node ] ];
				}
		}

		var ret = [];
		for (var i = 1; i < node.length; i++)
				ret.push.apply(ret, make_seq_to_statements(node[i]));

		return ret;
}


function move_statement_forward(statements) {
		statements = (function(a, prev) {
				statements.forEach(function(cur) {
						switch (cur[0]) {
								case "for":
										if (cur[1] != null) {
												a.push.apply(a, make_seq_to_statements(cur[1]));
												cur[1] = null;
										}
										a.push(cur);
										break;

								case "stat":
										a.push.apply(a, make_seq_to_statements(cur[1]));
										break;

								default:
										a.push(cur);
						}
				});
				return a;
		})([]);

		// Change a++ and a-- to ++a and --a if it is the only thing in a statement
		// The reason we do this is that we may be able to move it into the next
		// statement if we change it
		statements = (function(a, prev) {
				statements.forEach(function(cur) {
						if (cur[0] == "stat" && cur[1][0] == "unary-postfix")
								cur[1][0] = "unary-prefix";

						a.push(cur);
				});
				return a;
		})([]);

		statements = (function(a, nextPrev) {
				statements.forEach(function(cur) {
						a.push(cur);

						var prev = nextPrev;

						nextPrev = return_values(cur);

						if (!prev) return;

						var c = find_first_execute(cur);
						if (!c) return;

						for (var i = 0; i < prev.length; i++) {
								if (compare_array(c, prev[i])) {
										c.splice(0, c.length);
										c.push.apply(c, a[a.length - 2][1]);
										a[a.length - 2] = cur;
										a.splice(a.length - 1, 1);

										nextPrev = return_values(cur);
										break;
								}
						}
				});
				return a;
		})([]);

		return statements;
}

exports.move_statement_forward = move_statement_forward;

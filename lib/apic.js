define(function(require) {
    // todo: remove dependency
    var request = require('jquery').ajax;

    return function apic(desc, ssl, options) {
        var base = desc.base,
            safeMethods = { 'GET': true, 'HEAD': true, 'OPTIONS': true },
            tokenHeader = options.tokenHeader || 'X-Security-Token',
            aliases = options.aliases || {
                'PUT': ['save'],
                'POST': ['add'],
                'DELETE': ['remove']
            };

        function token(value) {
            value !== undefined && (token.value = value);
            return token.value
        }

        function last(arr) {
            return typeof arr[arr.length - 1];
        }

        function method(verb, uri, result, params, secure) {
            var safe = safeMethods[verb] || false,
                protocol = ssl || (secure = secure || !safe) ? 'https:' : 'http:';

            return function () {
                var args = Array.prototype.slice.call(arguments),
                    callback = last(args) === 'function' ? args.pop() : undefined,
                    query = last(args) === 'object' ? args.pop() : {},
                    path = uri,
                    headers = {}
                    ;

                if (args.length !== params.length && params.reduce(function (a, b) {
                    return a + +query.hasOwnProperty(b);
                }, 0) !== params.length)
                    throw new Error([
                        params.length, ' argument', (params.length === 1 ? '' : 's'),
                        params.length ? ' (' + params.join(', ') + ')' : '',
                        ' expected ', args.length, ' given',
                        args.length ? ' (' + args.join(', ') + ')' : ''
                    ].join(''));

                params.forEach(function (name, i) {
                    if (query[name] && args[i])
                        throw new Error('Duplicate key (' + name + ')');

                    var _ = '{' + name + '}',
                        value = args[i] || query[name];

                    path.indexOf(_) === -1
                        ? (path += '/' + value)
                        : (path = path.replace(_, value));
                });

                secure && (headers[tokenHeader] = token());

                request(verb, protocol + base + path, query, headers)
                    .done(function (data) {
                        callback && (callback.length > 1
                            ? callback(null, result ? data[result] : null)
                            : callback(result ? data[result] : null)
                            );
                    })
                    .fail(function (xhr) {
                        var err = {};

                        if (xhr.responseText) {
                            try {
                                err = JSON.parse(xhr.responseText)['error'] || {};
                            }
                            catch (e) {
                            }
                        }

                        err.status = xhr.status;

                        callback && callback.length > 1 && callback(err);
                    })
                    .always(function (xhr) {
                        secure && token(xhr.getResponseHeader(tokenHeader));
                    });
            };
        }

        return function generate(map, url) {
            var res = { },
                key,
                value,
                parts,
                secure,
                _;

            for (key in map)
                if (map.hasOwnProperty(key) && key !== '@') {
                    value = map[key];

                    key = (parts = key.split('#')).shift();

                    if (key.charAt(key.length - 1) === '*')
                        secure = !!(key = key.substring(0, key.length - 1));

                    if (key.charAt(0) !== ':') {
                        res[_ = key.toLowerCase()] = typeof value === 'string'
                            ? method(key, url || '/', value, parts, secure)
                            : generate(value, (url || '') + '/' + (value['@'] || key));

                        aliases[key] && aliases[key].forEach(function (alias) {
                            res[alias] = res[_];
                        })
                    } else
                        res[key.substr(1)] = res[value.toLowerCase()];
                }

            return res;
        }(desc.resources);
    };
});
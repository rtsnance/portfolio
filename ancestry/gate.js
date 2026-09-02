(function () {
  var f = document.getElementById('f'), p = document.getElementById('p'),
      b = document.getElementById('b'), m = document.getElementById('m');
  var D = null, loading = null;

  function b2a(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function payload() {
    if (D) return Promise.resolve(D);
    if (!loading) loading = fetch('payload.json').then(function (r) {
      if (!r.ok) throw new Error('payload');
      return r.json();
    }).then(function (j) { D = j; return j; });
    return loading;
  }
  // warm the payload so entry feels instant
  payload().catch(function () {});

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var pass = (p.value || '').trim().toUpperCase();
    if (!pass) return;
    b.disabled = true;
    m.textContent = 'Opening';
    payload().then(function (D) {
      return crypto.subtle
        .importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
        .then(function (base) {
          return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: b2a(D.salt), iterations: D.iters, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        })
        .then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2a(D.iv) }, key, b2a(D.ct));
        });
    }).then(function (buf) {
      var html = new TextDecoder().decode(buf);
      document.open();
      document.write(html);
      document.close();
    }).catch(function () {
      b.disabled = false;
      m.textContent = 'Not that word. Try again.';
      p.value = '';
      p.focus();
    });
  });
})();

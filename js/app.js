var UCE = window.UCE || {},
    Handlebars = window.Handlebars;

// From: http://bit.ly/1gAKKPP
function isInPhoneGap() {
  return !(/^http[s]?:\/\//).test(document.URL);
}

// Wait for PhoneGap to initialize
UCE.deviceReadyDfd = new $.Deferred();
if (isInPhoneGap()) {
  document.addEventListener('deviceready', UCE.deviceReadyDfd.resolve, true);
} else {
  // If not in phonegap (i.e. web dev) just resolve immediately
  UCE.deviceReadyDfd.resolve();
}

UCE.log = function (s) {
  console.log('UCE: ' + s);
};

UCE.cancelEvent = function (e) {
  if (!e) { return false; }
  e.preventDefault();
  e.stopPropagation();
  return false;
};

UCE.init = function () {
  UCE.log('App ready!');
  UCE.bindListeners();

  if (UCE.isLoggedIn()) {
    UCE.showScan();
  } else {
    UCE.showLogin();
  }
};

UCE.bindListeners = function () {
  $('.btn-login').on('click', UCE.submitLogin);
  $('.btn-scan').on('click', UCE.scanTicket);
  $('.btn-submit').on('click', UCE.submitManualCode);
  $('.hide').on('click', UCE.reset);
};

UCE.showPage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred();

  UCE.log('Showing page ' + selector);
  $el.addClass('show');

  requestAnimationFrame(function () {
    UCE.log('Frame 1 ');
    requestAnimationFrame(function () {
      UCE.log('Frame 2 - adding fadein ');
      if (!$el.hasClass('fadein')) {
        $el.one('transitionend', dfd.resolve);
        $el.addClass('fadein');
      } else {
        dfd.resolve();
      }
    });
  });

  return dfd.promise().then(function () { UCE.log('Done animation'); });
};

UCE.hidePage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred();

  UCE.log('Hiding page ' + selector);

  if ($el.hasClass('fadein')) {
    $el.one('transitionend', dfd.resolve);
    $el.removeClass('fadein');
  } else {
    dfd.resolve();
  }

  return dfd.promise().then(function () {
    UCE.log('Fade done');
    requestAnimationFrame(function () {
      UCE.log('Removing show class');
      $el.removeClass('show');
    });
  });
};

UCE.showValid = _.partial(UCE.showPage, '.page-valid');
UCE.showInvalid = _.partial(UCE.showPage, '.page-invalid');
UCE.showLogin = _.partial(UCE.showPage, '.page-login');
UCE.showScan = _.partial(UCE.showPage, '.page-scan');
UCE.hideValid = _.partial(UCE.hidePage, '.page-valid');
UCE.hideInvalid = _.partial(UCE.hidePage, '.page-invalid');
UCE.hideLogin = _.partial(UCE.hidePage, '.page-login');
UCE.hideScan = _.partial(UCE.hidePage, '.page-scan');

UCE.loginAjax = function (username, password) {
  var dfd = new $.Deferred();

  setTimeout(function () {
    var mockData, rand = Math.random();

    if (rand < 0.1) {
      return dfd.reject();  // Mimic failed ajax request
    } else if (rand < 0.4) {
      mockData = {
        response: {
          status: '-1',
          ClientName: 'John Doe',
          LogoURL: 'img/uce.jpg'
        }
      };
    } else if (rand < 0.7) {
      mockData = {
        response: {
          status: '0',
          ClientName: 'John Doe',
          LogoURL: 'img/uce.jpg'
        }
      };
    } else {
      mockData = {
        response: {
          status: '1',
          ClientName: 'John Doe',
          LogoURL: 'img/uce.jpg'
        }
      };
    }

    dfd.resolve(mockData);
  }, 1000);

  return dfd.promise();
};

UCE.isLoggedIn = function () {
  var clientName = window.lscache.get('ClientName');
  return clientName != null;
};

UCE.cacheLogin = function (response) {
  UCE.clearLogin();
  window.lscache.set('ClientName', response.ClientName, 30);
  window.lscache.set('LogoURL', response.LogoURL, 30);
};

UCE.clearLogin = function (response) {
  window.lscache.remove('ClientName');
  window.lscache.remove('LogoURL');
};

UCE.submitLogin = function (e) {

  var username, password;

  UCE.cancelEvent(e);

  function success(response) {
    if (response.valid) {
      UCE.cacheLogin(response);
      return UCE.hideLogin().then(UCE.showScan);
    } else {
      UCE.clearLogin(response);
      window.alert(response.message);
    }
  }

  function error(e) {
    UCE.log('Could not login');
    window.alert('Login could not be processed.  Please make sure you have ' +
                 'a valid internet connection and try again.');
  }

  function enhanceData(data) {
    if (data.response.status === '-1') {
      data.response.valid = false;
      data.response.message = 'Sorry, this account has been locked out.';
    } else if (data.response.status === '0') {
      data.response.valid = false;
      data.response.message = 'Incorrect username/password combination.';
    } else {
      data.response.valid = true;
    }
    return data.response;
  }

  username = $('#username').val();
  password = $('#password').val();

  if (username.length === 0 || password.length === 0) {
    window.alert('Please enter a username and password');
    return;
  }

  return UCE.loginAjax(username, password)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.reset = function (e) {
  UCE.cancelEvent(e);
  UCE.hideValid();
  UCE.hideInvalid();
  $('.input-qrcode').val('');
};

UCE.scanTicket = function (e) {
  var scanner = UCE.getBarcodeScanner();

  UCE.cancelEvent(e);

  function success(result) {
    if (result.cancelled !== 0) {
      UCE.log('User cancelled the scan.');
      return;
    } else if (result.format !== 'QR_CODE') {
      UCE.log('QR code not found.');
      return;
    }

    UCE.log('Scanned code: ' + result.text);
    UCE.submitTicket(result.text);
  }

  function error () {
    UCE.showInvalid();
  }

  if (!scanner) {
    success({
      cancelled: 0,
      format: 'QR_CODE',
      text: window.prompt('Enter a code', '123456789')
    });
    return;
  }

  scanner.scan(success, error);
};

UCE.getBarcodeScanner = function () {
  if (window.cordova && window.cordova.plugins &&
      window.cordova.plugins.barcodeScanner) {
    return window.cordova.plugins.barcodeScanner;
  }
  return null;
};

UCE.submitManualCode = function (e) {
  var $code = $('.input-qrcode'),
      code = $code.val();

  if (code.trim() === '') {
    UCE.log('Invalid code entered');
    window.alert('Please enter a valid Ticket Code');
    return;
  }

  UCE.cancelEvent(e);
  UCE.submitTicket(code);
};

UCE.ticketAjax = function (code) {
  var dfd = new $.Deferred();

  setTimeout(function () {
    var mockData;

    if (Math.random() < 0.1) {
      return dfd.reject();  // Mimic failed ajax request
    } else if (Math.random() < 0.55) {
      mockData = {
        response: {
          status: '1',
          TicketType: 'VIP'
        }
      };
    } else {
      mockData = {
        response: {
          status: '0',
          TicketType: null
        }
      };
    }

    dfd.resolve(mockData);
  }, 1000);

  UCE.log('Faking ajax call..');
  return dfd.promise();
};

UCE.submitTicket = function (code) {

  function success(response) {
    var source, template;
    if (response.valid) {
      source = $('#tpl-valid').html();
      template = Handlebars.compile(source);
      $('.page-valid .content').html(template(response));
      return UCE.showValid();
    } else {
      source = $('#tpl-invalid').html();
      template = Handlebars.compile(source);
      $('.page-invalid .content').html(template(response));
      return UCE.showInvalid();
    }
  }

  function error(e) {
    UCE.log('Could not submit ticket');
    window.alert('Ticket could not be submitted.  Please make sure you have ' +
                 'a valid internet connection and try again.');
  }

  function enhanceData(data) {
    data.response.valid = (data.response.status === '1');
    data.response.TicketCode = code;
    return data.response;
  }

  return UCE.ticketAjax(code)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.deviceReadyDfd.promise().done(UCE.init);

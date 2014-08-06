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

UCE.init = function () {
  UCE.log('App ready!');
  UCE.bindListeners();
};

UCE.bindListeners = function () {
  $('.btn-scan').on('click', UCE.scanTicket);
  $('.btn-submit').on('click', UCE.submitManualCode);
  $('.hide').on('click', UCE.reset);
};

UCE.showPage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred();

  $el.one('transitionend', dfd.resolve);
  $el.addClass('show');

  return dfd.promise();
};

UCE.hidePage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred();

  $el.one('transitionend', dfd.resolve);
  $el.removeClass('show');

  return dfd.promise();
};

UCE.showValid = _.partial(UCE.showPage, '.page-valid');
UCE.showInvalid = _.partial(UCE.showPage, '.page-invalid');
UCE.hideValid = _.partial(UCE.hidePage, '.page-valid');
UCE.hideInvalid = _.partial(UCE.hidePage, '.page-invalid');

UCE.reset = function () {
  UCE.hideValid();
  UCE.hideInvalid();
  $('.input-qrcode').val('');
};

UCE.scanTicket = function () {
  var scanner = UCE.getbarcodeScanner();

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
  }

  scanner.scan(success, error);
};

UCE.getbarcodeScanner = function () {
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

  UCE.submitTicket(code);
};

UCE.submitTicket = function (code) {
  var dfd = new $.Deferred();

  setTimeout(function () {
    var mockData;

    if (Math.random() < 0.1) {
      return dfd.reject();  // Mimic failed ajax request
    } else if (Math.random() < 0.55) {
      mockData = {
        valid: true,
        ticketCode: code,
        ticketType: 'VIP',
        attendeeName: 'John Doe'
      };
    } else {
      mockData = {
        valid: false,
        ticketCode: code,
        error: 'Ticket already redeemed'
      };
    }

    dfd.resolve(mockData);
  }, 1000);

  function success(data) {
    var source, template;
    if (data.valid) {
      source = $('#tpl-valid').html();
      template = Handlebars.compile(source);
      $('.page-valid .content').html(template(data));
      return UCE.showValid();
    } else {
      source = $('#tpl-invalid').html();
      template = Handlebars.compile(source);
      $('.page-invalid .content').html(template(data));
      return UCE.showInvalid();
    }
  }

  function error(e) {
    UCE.log('Could not submit ticket');
    window.alert('Ticket could not be submitted.  Please make sure you have ' +
                 'a valid internet connection and try again.');
  }

  return dfd.promise().then(success, error);
};

UCE.deviceReadyDfd.promise().done(UCE.init);

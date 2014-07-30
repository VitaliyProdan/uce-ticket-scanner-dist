var UCE = window.UCE || {};

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
  var dfd = new $.Deferred();

  function success(code) {
    code = '123456789';
    UCE.log('Scanned code: ' + code);
    UCE.showValid();
    dfd.resolve();
  }

  function error () {
    UCE.showInvalid();
    dfd.reject();
  }

  if (Math.random() > 0.5) {
    setTimeout(success, 250);
  } else {
    setTimeout(error, 250);
  }

  return dfd.promise();
};

UCE.deviceReadyDfd.promise().done(UCE.init);

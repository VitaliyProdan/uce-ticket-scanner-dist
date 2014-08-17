var UCE = window.UCE || {},
    Handlebars = window.Handlebars,
    lscache = window.lscache;

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
  $('.password').on('keyup', UCE.loginOnEnter);
  $('.btn-refresh').on('click', UCE.refreshLogin);
  $('.btn-scan').on('click', UCE.scanTicket);
  $('.btn-logout').on('click', UCE.logout);
  $('.btn-scan-again').on('click', UCE.scanAgain);
  $('.btn-manual').on('click', UCE.goToManual);
  $('.btn-back').on('click', UCE.goToScan);
  $('.btn-submit').on('click', UCE.submitManualCode);
  $('.input-qrcode').on('keyup', UCE.submitManualCodeOnEnter);
  $('.hide').on('click', UCE.reset);
};

UCE.showPage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred(),
      logo, clientName;

  UCE.log('Showing page ' + selector);
  $el.addClass('show');

  if (selector === '.page-scan') {
    logo = UCE.getLogoUrl();
    if (logo) { $('.header img').attr('src', logo).show(); }
    clientName = UCE.getClientName();
    if (clientName) { $('.client-name').text(clientName); }
  } else if (selector === '.page-login') {
    $('.header img').attr('src', '').hide();
    $('.client-name').text('');
  }

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
UCE.showManual = _.partial(UCE.showPage, '.page-manual');
UCE.showLocked = _.partial(UCE.showPage, '.page-locked');
UCE.hideValid = _.partial(UCE.hidePage, '.page-valid');
UCE.hideInvalid = _.partial(UCE.hidePage, '.page-invalid');
UCE.hideLogin = _.partial(UCE.hidePage, '.page-login');
UCE.hideScan = _.partial(UCE.hidePage, '.page-scan');
UCE.hideManual = _.partial(UCE.hidePage, '.page-manual');
UCE.hideLocked = _.partial(UCE.hidePage, '.page-locked');

UCE.ajax = function (step, data) {
  var endpoint = 'http://www.upcomingevents.com/ticketscanner/process.asp';

  if (!data) { data= {}; }

  data.step = step;

  function success (data) {
    console.log("Ajax success: ");
    console.log(data);
  }

  function error (e) {
    console.error("Ajax error: " + e);
  }

  return $.ajax({
    url: endpoint,
    dataType: 'json',
    data: data
  }).done(success).fail(error);
};

UCE.loginAjax = function (username, password) {
  var dfd = new $.Deferred(),
      data = {
        username: username,
        password: password,
        clientId: UCE.getClientId(),
        appSessionId: UCE.getAppSessionId(true),
        apptype: UCE.getPlatformType(),
        platform: UCE.getPhoneAndVersion()
      };

  return UCE.ajax('login', data);
};

UCE.getPlatformType = function () {
  var platform;
  if (window.device && window.device.platform) {
    platform = window.device.platform.toLowerCase();
    if (platform === 'android') {
      return 'a';
    } else if (platform === 'ios') {
      return 'i';
    }
  }
  return 'unknown platform';
};

UCE.getPhoneModel = function () {
  if (window.device && window.device.model) {
    return window.device.model;
  }
  return 'unknown model';
};

UCE.getPlatformVersion = function () {
  if (window.device && window.device.version) {
    return window.device.version;
  }
  return 'unknown version';
};

UCE.getPhoneAndVersion = function () {
  return UCE.getPhoneModel() + ' - ' + UCE.getPlatformVersion();
};

UCE.generateAppSessionId = function () {
  var id = Math.floor(Math.random()*8999999999+1000000000);
  lscache.remove('appSessionId');
  lscache.set('appSessionId', id, 30);
  return id;
};

UCE.isAppSessionIdExpired = function () {
  return lscache.get('appSessionId') == null;
};

UCE.getAppSessionId = function (generate) {
  if (!UCE.isAppSessionIdExpired()) {
    return lscache.get('appSessionId');
  }
  return generate ? UCE.generateAppSessionId() : null;
};

UCE.getClientName = function () {
  return window.lscache.get('ClientName');
};

UCE.getClientId = function () {
  var clientId = window.lscache.get('ClientID');
  return (clientId ? clientId : '');
};

UCE.isLoggedIn = function () {
  var clientName = window.lscache.get('ClientName');
  if (clientName != null && !UCE.isAppSessionIdExpired()) {
    return true;
  }
  UCE.clearLogin();
  return false;
};

UCE.checkValidLoginStatus = function () {
  var sessionId = UCE.getAppSessionId();
  if (!UCE.isLoggedIn()) {
    window.alert("We're sorry, you have been logged out after 30 minutes " +
                 "of inactivity.  Please log in again");
    return false;
  }
  window.lscache.set('appSessionId', sessionId, 30);
  return true;
};

UCE.cacheLogin = function (response) {
  UCE.clearLogin();
  window.lscache.set('ClientID', response.status);
  window.lscache.set('ClientName', response.ClientName);
  window.lscache.set('LogoURL', response.LogoURL);
};

UCE.clearLogin = function (response) {
  window.lscache.remove('ClientID');
  window.lscache.remove('ClientName');
  window.lscache.remove('LogoURL');
};

UCE.getLogoUrl = function () {
  return window.lscache.get('LogoURL');
};

UCE.loginOnEnter = function (e) {
  if (e.keyCode === 13) {
    $(e.target).blur();
    UCE.submitLogin();
  }
  return false;
};

UCE.submitLogin = function (e) {

  var username, password;

  UCE.cancelEvent(e);

  function success(response) {
    if (response.valid) {
      UCE.cacheLogin(response);
      return UCE.hideLogin().then(UCE.showScan);
      $('.page-login .error').hide().text('');
    }

    UCE.clearLogin(response);
    if (response.locked) {
      UCE.hideLogin().then(UCE.showLocked);
    } else {
      $('.page-login .error').text(response.Message).show();
    }
  }

  function error(e) {
    UCE.log('Could not login');
    $('.page-login .error').text('Login could not be processed.  ' +
                                 'Please make sure you have ' +
                                 'a valid internet connection and ' +
                                 'try again.').show();
  }

  function enhanceData(data) {
    if (data.response.status === '-1') {
      data.response.valid = false;
      data.response.locked = true;
    } else if (data.response.status === '0') {
      data.response.valid = false;
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

UCE.refreshLogin = function (e) {
  UCE.cancelEvent(e);
  UCE.hideLocked().then(UCE.showLogin);
};

UCE.logout = function (e) {
  UCE.cancelEvent();
  UCE.clearLogin();
  UCE.hideScan().then(UCE.showLogin);
};

UCE.reset = function (e) {
  UCE.cancelEvent(e);
  UCE.hideValid();
  UCE.hideInvalid();
  $('.input-qrcode').val('');
};

UCE.scanAgain = function (e) {
  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.hideValid().then(UCE.showLogin);
  }

  UCE.hideValid().then(UCE.scanTicket);
};

UCE.scanTicket = function (e) {
  var scanner = UCE.getBarcodeScanner();

  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.hideScan().then(UCE.showLogin);
  }

  function success(result) {
    if (result.cancelled !== 0) {
      UCE.log('User cancelled the scan.');
      return;
    } else if (result.format !== 'QR_CODE') {
      UCE.log('QR code not found.');
      return;
    }

    UCE.log('Scanned code: ' + result.text);
    UCE.submitTicket(result.text, true);
  }

  function error () {
    UCE.showInvalid();
  }

  if (!scanner) {
    success({
      cancelled: 0,
      format: 'QR_CODE',
      text: window.prompt('Enter a code', '1777012821')
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

UCE.goToManual = function (e) {
  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.hideScan().then(UCE.showLogin);
  }

  UCE.hideScan().then(UCE.showManual);
};

UCE.goToScan = function (e) {
  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.hideManual().then(UCE.showLogin);
  }

  UCE.hideManual().then(UCE.showScan);
};

UCE.submitManualCodeOnEnter = function (e) {
  if (e.keyCode === 13) {
    $(e.target).blur();
    UCE.submitManualCode();
  }
  return false;
};

UCE.submitManualCode = function (e) {
  var $code = $('.input-qrcode'),
      code = $code.val();

  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.hideManual().then(UCE.showLogin);
  }

  if (code.trim() === '') {
    UCE.log('Invalid code entered');
    window.alert('Please enter a valid Ticket Code');
    return;
  }

  UCE.submitTicket(code, false);
};

UCE.uncheckin = function (code) {
  if (!code) { code = '1777012821'; }
  return UCE.ajax('uncheckin', { clientid: UCE.getClientId(), ticketnumber: code });
};

UCE.ticketAjax = function (code, fromScan) {
  var step = fromScan ? 'validatescan' : 'validatemanual',
      data,
      dfd = new $.Deferred();

  data = {
    clientid: UCE.getClientId(),
    ticketnumber: code
  }

  return UCE.ajax(step, data);
};

UCE.submitTicket = function (code, fromScan) {

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

  return UCE.ticketAjax(code, fromScan)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.deviceReadyDfd.promise().done(UCE.init);

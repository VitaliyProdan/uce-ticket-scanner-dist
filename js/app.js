var UCE = window.UCE || {},
    Handlebars = window.Handlebars,
    lscache = window.lscache;

// From: http://bit.ly/1gAKKPP
function isInPhoneGap() {
  return !(/^http[s]?:\/\//).test(document.URL);
}

UCE.config = {
  apiEndpoint: 'http://www.upcomingevents.com/ticketscanner/process.asp',
  loginTimeoutMins: 30,
  lsKeys: {
    appSessionId: 'app-session-id',
    clientId: 'client-id',
    clientName: 'client-name',
    logoUrl: 'logo-url',
    userId: 'user-id'
  }
};

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

//iOS Helper Functions
UCE.isIosPlatform = function () {
  var device = window.device;

  // If no phonegap device property, fall back to userAgent
  if (!device) {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // Try to check the platform
  if (device.platform) { return device.platform.match(/^ios/i); }

  if (device.model) {
      return device.model.match(/^iphone/i) ||
             device.model.match(/^ipad/i) ||
             device.model.match(/^ipod/i);
  }

  return false;
};

UCE.isAndroidPlatform = function () {
  return /android/i.test(navigator.userAgent);
};


UCE.init = function () {
  UCE.log('App ready!');
  UCE.bindListeners();

  // Make iOS7 behave like iOS 6 where the status bar is not on top of the web view
  if (window.StatusBar && window.StatusBar.overlaysWebView && UCE.isIosPlatform()) {
    window.StatusBar.overlaysWebView(false);
  }

  if (UCE.isLoggedIn()) {
    UCE.showScan();
  } else {
    UCE.showLogin();
  }
};

UCE.bindListeners = function () {
  $('.btn-login').hammer().on('tap', UCE.submitLogin);
  $('.btn-refresh').hammer().on('tap', UCE.refreshLogin);
  $('.btn-scan').hammer().on('tap', UCE.scanTicket);
  $('.btn-logout').hammer().on('tap', UCE.logout);
  $('.btn-scan-again').hammer().on('tap', UCE.scanAgain);
  $('.btn-manual').hammer().on('tap', UCE.goToManual);
  $('.btn-back').hammer().on('tap', UCE.goToScan);
  $('.btn-submit').hammer().on('tap', UCE.submitManualCode);
  $('.hide').hammer().on('tap', UCE.reset);

  $('.password').on('keyup', UCE.loginOnEnter);
  $('.input-qrcode').on('keyup', UCE.submitManualCodeOnEnter);
};

UCE.transitionPage = function (selector) {
  var $cur = $('.show'), toks;

  if ($cur.length === 0) { return UCE.showPage(selector); }

  toks = $cur.attr('class').match(/(page-[a-z]+)/);

  if (toks.length < 2 || '.' + toks[1] === selector) {
    return UCE.showPage(selector);
  }

  return UCE.hidePage('.' + toks[1]).then(_.partial(UCE.showPage, selector));
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
      $el.find('.error').hide().html('');
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
  if (!data) { data= {}; }

  data.step = step;

  var spinner = window.plugins ? window.plugins.spinnerDialog : null;

  function success (data) {
    console.log("Ajax success: ");
    console.log(data);
  }

  function error (e) {
    console.error("Ajax error: " + e);
  }

  function hideSpinner() {
    if ( spinner) { spinner.hide(); }
  }

  if (spinner) {
    spinner.show();
  }

  return $.ajax({
    url: UCE.config.apiEndpoint,
    dataType: 'json',
    data: data
  }).done(success).fail(error).always(hideSpinner);
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
  lscache.remove(UCE.config.lsKeys.appSessionId);
  lscache.set(UCE.config.lsKeys.appSessionId, id, UCE.config.loginTimeoutMins);
  return id;
};

UCE.isAppSessionIdExpired = function () {
  return lscache.get(UCE.config.lsKeys.appSessionId) == null;
};

UCE.getAppSessionId = function (generate) {
  if (!UCE.isAppSessionIdExpired()) {
    return lscache.get(UCE.config.lsKeys.appSessionId);
  }
  return generate ? UCE.generateAppSessionId() : null;
};

UCE.getClientName = function () {
  return window.lscache.get(UCE.config.lsKeys.clientName);
};

UCE.getClientId = function () {
  var clientId = window.lscache.get(UCE.config.lsKeys.clientId);
  return (clientId ? clientId : '');
};

UCE.getUserId = function () {
  var userId = window.lscache.get(UCE.config.lsKeys.userId);
  return (userId ? userId : '');
};

UCE.isLoggedIn = function () {
  var clientName = window.lscache.get(UCE.config.lsKeys.clientName);
  if (clientName != null && !UCE.isAppSessionIdExpired()) {
    return true;
  }
  UCE.clearLogin();
  return false;
};

UCE.checkValidLoginStatus = function () {
  var sessionId = UCE.getAppSessionId();
  if (!UCE.isLoggedIn()) {
    $('.page-login .error').html('We are sorry, you have been logged out due ' +
                                 'to 30 minutes of inactivity.  Please log ' +
                                 'in again.')
                           .show();
    return false;
  }
  window.lscache.set(UCE.config.lsKeys.appSessionId, sessionId, UCE.config.loginTimeoutMins);
  return true;
};

UCE.cacheLogin = function (response) {
  UCE.clearLogin();
  window.lscache.set(UCE.config.lsKeys.clientId, response.status);
  window.lscache.set(UCE.config.lsKeys.clientName, response.ClientName);
  window.lscache.set(UCE.config.lsKeys.logoUrl, response.LogoURL);
  window.lscache.set(UCE.config.lsKeys.userId, response.UserID);
};

UCE.clearLogin = function (response) {
  window.lscache.remove(UCE.config.lsKeys.clientId);
  window.lscache.remove(UCE.config.lsKeys.clientName);
  window.lscache.remove(UCE.config.lsKeys.logoUrl);
  window.lscache.remove(UCE.config.lsKeys.userId);
};

UCE.getLogoUrl = function () {
  return window.lscache.get(UCE.config.lsKeys.logoUrl);
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
      $('.page-login .error').hide().text('');
      return UCE.transitionPage('.page-scan');
    }

    UCE.clearLogin(response);
    if (response.locked) {
      return UCE.transitionPage('.page-locked');
    } else {
      $('.page-login .error').text(response.Message).show();
    }
  }

  function error(e) {
    UCE.log('Could not login');
    $('.page-login .error').html('Login could not be processed.  ' +
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
    $('.page-login .error').html('Please enter a username and password').show();
    return;
  }

  return UCE.loginAjax(username, password)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.refreshLogin = function (e) {
  UCE.cancelEvent(e);
  return UCE.transitionPage('.page-login');
};

UCE.logout = function (e) {
  UCE.cancelEvent();
  UCE.clearLogin();
  return UCE.transitionPage('.page-login');
};

UCE.reset = function (e) {
  UCE.cancelEvent(e);
  $('.input-qrcode').val('');
  return UCE.transitionPage('.page-scan');
};

UCE.scanAgain = function (e) {
  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.transitionPage('.page-login');
  }

  UCE.scanTicket();
};

UCE.scanTicket = function (e) {
  var scanner = UCE.getBarcodeScanner();

  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.transitionPage('.page-login');
  }

  function success(result) {
    $('.page-scan .error').hide().html('').hide();
    if (result.cancelled) {
      UCE.log('User cancelled the scan.');
      return UCE.transitionPage('.page-scan');
    } else if (result.format !== 'QR_CODE') {
      UCE.log('QR code not found.');
      $('.page-scan .error').html('QR Code not found.  Please try again.').show();
      return UCE.transitionPage('.page-scan');
    }

    UCE.log('Scanned code: ' + result.text);
    UCE.submitTicket(result.text, true);
  }

  function error () {
    return UCE.transitionPage('.page-invalid');
  }

  // Fallback for browser testing
  if (!scanner) {
    success({
      cancelled: 0,
      format: 'QR_CODE',
      text: window.prompt('Enter a code', '')
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
    return UCE.transitionPage('.page-login');
  }

  return UCE.transitionPage('.page-manual');
};

UCE.goToScan = function (e) {
  UCE.cancelEvent(e);

  if (!UCE.checkValidLoginStatus()) {
    return UCE.transitionPage('.page-login');
  }

  return UCE.transitionPage('.page-scan');
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
    return UCE.transitionPage('.page-login');
  }

  if (code.trim() === '') {
    UCE.log('Invalid code entered');
    $('.page-manual .error').html('Please enter a valid Ticket Code').show();
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
      data;

  data = {
    clientid: UCE.getClientId(),
    userid: UCE.getUserId(),
    ticketnumber: code
  };

  return UCE.ajax(step, data);
};

UCE.submitTicket = function (code, fromScan) {

  function success(response) {
    var source, template;
    if (response.valid) {
      source = $('#tpl-valid').html();
      template = Handlebars.compile(source);
      $('.page-valid .content').html(template(response));
      return UCE.transitionPage('.page-valid');
    } else {
      source = $('#tpl-invalid').html();
      template = Handlebars.compile(source);
      $('.page-invalid .content').html(template(response));
      return UCE.transitionPage('.page-invalid');
    }
  }

  function error(e) {
    UCE.log('Could not submit ticket');
    $('.show .error').html('Ticket could not be submitted. ' +
                           'Please make sure you have a valid ' +
                           'internet connection and try again.')
                     .show();
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

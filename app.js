/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var watsonServices = ['dialog', 'text_to_speech'];

var express = require('express'),
  app = express(),
  request = require('request'),
  bluemix = require('./config/bluemix'),
  extend = require('util')._extend;

// Bootstrap application settings
require('./config/express')(app);

// Read user-defined secrets
var allCredentials = {};
try {
  allCredentials = require('./secrets.json');
} catch (e) {
  console.log('No local secrets were found');
  allCredentials = {};
}


// Create proxies for each Watson service
watsonServices.forEach(function (item) {
  console.log('-> Processing item: ' + item);
  // if bluemix credentials exists, then override local
  var credentials = extend(allCredentials[item], bluemix.getServiceCreds(item)); // VCAP_SERVICES

  var proxyFunc;
  if (!credentials) {
    console.warn('No credentials have been found for Watson service "' +
      item + '" - this service will be unavailable');
    proxyFunc = function (req, res) {
      res.status(404).json({
        code: 404,
        error: 'No credentials have been set for Watson service "' + item + '"'
      });
    };
  } else {
    proxyFunc = function (req, res) {
      var newUrl = credentials.url + req.url;
      console.log('Proxy function invoked for ' + item + ' on ' + newUrl);

      req.pipe(request({
        url: newUrl,
        auth: {
          user: credentials.username,
          pass: credentials.password,
          sendImmediately: true
        }
      }, function (error) {
        if (error || res.statusCode < 200 || res.statusCode >= 400) {
          console.error('An error occurred while invoking Watson service ' + item + ': ');
          if (error) {
            console.error(error);
            res.status(500).json({
              code: 500,
              error: errorMessage
            });
          } else {
            console.error(res.statusMessage);
          }

        }
      })).pipe(res);
    }
  }

  // HTTP proxy to the API
  var proxyURL = '/proxy/' + item;
  app.use(proxyURL, proxyFunc);
  console.log('Registered URL: ' + proxyURL);
});

// render index page
app.get('/', function (req, res) {
  res.render('index');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.code = 404;
  err.message = 'Not Found';
  next(err);
});

// 500 error message
var errorMessage = 'There was a problem with the request, please try again';

// non 404 error handler
app.use(function (err, req, res) {
  var error = {
    code: err.code || 500,
    error: err.message || err.error || errorMessage
  };

  console.log('error:', error);
  res.status(error.code).json(error);
});

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
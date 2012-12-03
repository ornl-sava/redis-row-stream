/*
  Node.js module to persist a stream of items to Redis
*/

/*jshint node:true, indent:2, globalstrict: true, asi: true, laxcomma: true, laxbreak: true */
/*global module:true, require:true, console:true */

'use strict';

var Stream = require('stream').Stream
  , util = require('util')
  , redis = require('redis')
  , reds = require('reds')

module.exports = RedisRowStream

//RedisRowStream constructor available options: 
//  opts.structure      //redis data structure: either 'string' or 'hash'
//  opts.keyPrefix      //all keys will be of the form keyPrefix:counter
//  opts.index          //if true, will index all results with reds.  Note that this can slow output somewhat.  see https://github.com/visionmedia/reds
//  opts.indexedFields  //if above is true, these fields will be indexed
//  opts.serverAddress  //address of redis server
//  opts.serverPort     //port of redis server
//  opts.redisOpts      //see https://github.com/mranney/node_redis#rediscreateclientport-host-options for options.
function RedisRowStream(opts) {
  this.writable = true
  this.readable = true

  this._paused = this._ended = this._destroyed = false

  this._buffer = ''

  Stream.call(this)
  
  this.eventID = 0 //will be appended to end of all keys to guarantee unique.  Counts events.


  if (! opts)
    opts = {}
    
  // redis address
  if (! opts.serverPort)
    opts.serverPort = 6379
  if (! opts.serverAddress)
    opts.serverAddress = "localhost"

  // show what is going on in the console
  this.verbose = opts.verbose || false
  
  // use [reds](https://github.com/visionmedia/reds) to index data
  this.index = opts.index ? true : false

  // fields to index, if any
  this.indexedFields = opts.indexedFields || []

  // data structure to store the data in: either 'string' (default) or 'hash'
  this.structure = opts.structure || "string"

  // the string to prefix each key (key format: keyPrefix:counter)
  this.keyPrefix = opts.keyPrefix || "Default"
    
  // redis specific options, passed to [node-redis](https://github.com/mranney/node_redis)
  var redisOpts = opts.redisOpts || {}

  this.redisClient = redis.createClient(opts.serverPort, opts.serverAddress, redisOpts)

  return this
}

util.inherits(RedisRowStream, Stream)

/**
 *
 * Parse a chunk and emit the parsed data. Implements writable stream method [stream.write(string)](http://nodejs.org/docs/latest/api/stream.html#stream_stream_write_string_encoding)
 * Assumes UTF-8
 * 
 * @param {String} data to write to stream (assumes UTF-8)
 * @return {boolean} true if written, false if it will be sent later
 *
 */
RedisRowStream.prototype.write = function (record) {
  // cannot write to a stream after it has ended
  if (this._ended) 
    throw new Error('RedisRowStream: write after end')

  if (! this.writable)
    throw new Error('RedisRowStream: not a writable stream')
  
  if (this._paused)
    return false

  var key = this.keyPrefix + ':' + this.eventID

  if (this.verbose)
    console.log('redis> HMSET key ' + key + ' ' + util.inspect(record))
  
  //TODO callback need to do anything?
  if (this.structure === 'string')
    this.redisClient.set(key, JSON.stringify(record), function (err, res) {  })
  else if (this.structure === 'hash')
    this.redisClient.hmset(key, record, function (err, res) {  })

  //console.log('index flag set ' + this.index + ', indexedFields: ' + util.inspect(this.indexedFields))
  if (this.index) {
    var search = reds.createSearch('search')
    var field = ""
    for (var i = 0; i < this.indexedFields.length; i++) {
      field = this.indexedFields[i]
      if (field && field !== "") {
        if (this.verbose)
          console.log('index> \'' + record[field] + '\' => ' + key)
        search.index(record[field], key)
      }
    }
  }

  this.eventID += 1

  return true  
}

/*
 *
 * Write optional parameter and terminate the stream, allowing queued write data to be sent before closing the stream. Implements writable stream method [stream.end(string)](http://nodejs.org/docs/latest/api/stream.html#stream_stream_end)
 *
 * @param {String} data The data to write to stream (assumes UTF-8)
 *
 */
RedisRowStream.prototype.end = function (str) {
  if (this._ended) return
  
  if (! this.writable) return
  
  if (arguments.length)
    this.write(str)
  
  this._ended = true
  this.readable = false
  this.writable = false

  this.emit('end')
  this.emit('close')
}

/*
 *
 * Pause the stream. Implements readable stream method [stream.pause()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_pause)
 *
 */
RedisRowStream.prototype.pause = function () {
  if (this._paused) return
  
  this._paused = true
  this.emit('pause')
}

/*
 *
 * Resume stream after a pause, emitting a drain. Implements readable stream method [stream.resume()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_resume)
 *
 */
RedisRowStream.prototype.resume = function () {
  if (this._paused) {
    this._paused = false
    this.emit('drain')
  }
}

/*
 *
 * Destroy the stream. Stream is no longer writable nor readable. Implements writable stream method [stream.destroy()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_destroy_1)
 *
 */
RedisRowStream.prototype.destroy = function () {
  if (this._destroyed) return
  
  this._destroyed = true
  this._ended = true

  this.readable = false
  this.writable = false

  this.emit('end')
  this.emit('close')
}

RedisRowStream.prototype.flush = function () {
  this.emit('flush')
}


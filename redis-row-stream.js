/*
  Node.js module to persist a stream of items to Redis
*/

'use strict';

var Stream = require('stream').Stream
  , util = require('util')
  , redis = require('redis')
  , reds = require('reds')

var verbose = false //TODO meh.

module.exports = RedisRowStream

//RedisRowStream constructor available options: 
//  opts.keyPrefix      //all keys will be of the form keyPrefix:counter
//  opts.index          //if true, will index all results with reds.  Note that this can slow output somewhat.  see https://github.com/visionmedia/reds
//  opts.indexedFields  //if above is true, these fields will be indexed
//  opts.serverAddress  //address of redis server
//  opts.serverPort     //port of redis server
//  opts.redisOpts      //see https://github.com/mranney/node_redis#rediscreateclientport-host-options for options.
function RedisRowStream (opts) {
  this.writable = true
  this.readable = true

  this._paused = this._ended = this._destroyed = false

  this._buffer = ''

  Stream.call(this)
  
  this.eventID = 0 //will be appended to end of all keys to guarantee unique.  Counts events.


  if (!opts)
    opts = {}
  if (!opts.serverPort)
    opts.serverPort = 6379
  if(!opts.serverAddress)
    opts.serverAddress = "localhost"

  if(opts.index)
    this.index = true
  else
    this.index = false

  if(opts.indexedFields)
    this.indexedFields = opts.indexedFields
  else
    this.indexedFields = []

  if(opts.keyPrefix)
    this.keyPrefix = opts.keyPrefix
  else
    this.keyPrefix = "Default"
  var redisOpts = {}
  if(opts.redisOpts) redisOpts = opts.redisOpts

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
  if ( this._ended ) 
    throw new Error('RedisRowStream: write after end')

  if ( ! this.writable ) 
    throw new Error('RedisRowStream: not a writable stream')
  
  if ( this._paused ) 
    return false

  var key = this.keyPrefix + ':' + this.eventID

  if(verbose){ 
    console.log('sending to redis: key: ' + key + ', val: ' + util.inspect(record))
  }
  //TODO callback need to do anything?
  this.redisClient.set(key, JSON.stringify(record), function (err, res){  }) //TODO

  //console.log('index flag set ' + this.index + ', indexedFields: ' + util.inspect(this.indexedFields))
  if(this.index){
    var search = reds.createSearch('search');
    var field = ""
    for(var i=0; i< this.indexedFields.length; i++){
      //search.index('blah something coffee', key);
      field = this.indexedFields[i]
      if(field && field !== "")
        search.index(record[field], key);
    }
    //search.index('Foo bar baz', 'abc');
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
  if ( this._ended ) return
  
  if ( ! this.writable ) return
  
  if ( arguments.length )
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
  if ( this._paused ) return
  
  this._paused = true
  this.emit('pause')
}

/*
 *
 * Resume stream after a pause, emitting a drain. Implements readable stream method [stream.resume()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_resume)
 *
 */
RedisRowStream.prototype.resume = function () {
  if ( this._paused ) {
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
  if ( this._destroyed ) return
  
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


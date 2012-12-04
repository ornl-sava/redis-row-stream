var RedisRowStream = require('../redis-row-stream.js')
  , fs = require('fs')
  , path = require('path')
  , util = require('util')
  , tester = require('stream-tester')
  , should = require('should')
  , redis = require('redis')
  , stringPrefix = 'stringRowTest'
  , hashPrefix = 'hashRowTest'

describe('redis row stream Tests', function() {

  // clear redis
  before(function(done) {
    var rc = redis.createClient(6379, 'localhost')
    rc.on('ready', function () {
      rc.del(stringPrefix + ':0', stringPrefix + ':1', stringPrefix + ':2', function (err) { 
        rc.del(hashPrefix + ':0', hashPrefix + ':1', hashPrefix + ':2', function (err) { 
          if (!err) done()
        })
      })
    })
  })

  describe('# simple stream test', function(){
    it('should pass pause-unpause stream tests', function(done){
      pauseUnpauseStream(done)
    })
  })

  describe('# string type pipe test', function(){
    it('should pass simple strings to redis strings data type', function(done){
      stringRowTest(done)
    })
  })

  describe('# hash type pipe test', function(){
    it('should pass simple objects to redis hash data type', function(done){
      hashRowTest(done)
    })
  })

}) 

var pauseUnpauseStream = function (done) {
  tester.createRandomStream(10000) //10k random numbers
    .pipe(tester.createUnpauseStream())
    .pipe(new RedisRowStream({}))
    .pipe(tester.createPauseStream())  
  setTimeout(function(){
    done()
  }, 500) //need some time here so that pipelines can empty and whatnot before moving on to other tests
}

var stringRowTest = function (done) {
  var inFile = path.join('test', 'input', 'simpleData.json')
    , opts = { 
        keyPrefix: stringPrefix   //prefix to attach to all keys
      }
    , result = []
    , expected = "{\"A label\":\"56\",\"B label\":\"78\",\"C label\":\"90\"}"

  var rc = redis.createClient(opts.serverPort, opts.serverAddress, opts.redisOpts)

  var testStream = new RedisRowStream(opts)

  rc.on('ready', function(){
    fs.readFile(inFile, function (err, data) {
      should.not.exist(err)
      data = JSON.parse(data)
      for (var i=0; i<data.length; i++)
        testStream.write(data[i])

      var check = function(){
        rc.keys(opts.keyPrefix+":*", function (err, replies) {
          should.not.exist(err)
          replies.length.should.eql(3)
          rc.get(opts.keyPrefix+":2", function(err, reply){
            should.not.exist(err)
            reply.should.eql(expected)
            done()
          })
        })
      }
      setTimeout(check, 500) //need some time here so that pipelines can empty
    })
  })
 
}

var hashRowTest = function (done) {
  var inFile = path.join('test', 'input', 'simpleData.json')
    , opts = { 
        keyPrefix: hashPrefix       // prefix to attach to all keys
      , structure: "hash"           // save into hash data type
    }
    , result = []
    , expected = {"A label":"56","B label":"78","C label":"90"}

  var rc = redis.createClient(opts.serverPort, opts.serverAddress, opts.redisOpts)

  var testStream = new RedisRowStream(opts)

  rc.on('ready', function(){
    fs.readFile(inFile, function (err, data) {
      should.not.exist(err)
      data = JSON.parse(data)
      for (var i=0; i<data.length; i++)
        testStream.write(data[i])

      var check = function(){
        rc.keys(opts.keyPrefix+":*", function (err, replies) {
          should.not.exist(err)
          replies.length.should.eql(3)
          rc.hgetall(opts.keyPrefix+":2", function(err, reply){
            should.not.exist(err)
            reply.should.eql(expected)
            done()
          })
        })
      }
      setTimeout(check, 500) //need some time here so that pipelines can empty
    })
  })
 
}


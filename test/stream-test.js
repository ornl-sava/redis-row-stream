var RedisRowStream = require('../redis-row-stream.js')
  , fs = require('fs')
  , path = require('path')
  , util = require('util')
  , tester = require('stream-tester')
  , should = require('should')
  , redis = require('redis')

describe('redis row stream Tests', function() {

  before(function(done) {
    var outPath = path.join('test', 'output')
    fs.exists(outPath, function(exists) {
      if (exists) {
        fs.readdir(outPath, function(err, files) {
          if ( files && files.length ) {
            for (var i = 0 ; i < files.length ; i++ ) {
              fs.unlink( path.join(outPath, files[i]), function(err) {
                if ( err )
                  throw err
              }) 
            }
          }
          done()
        })
      }
      else {
        fs.mkdir(outPath, 755, function(err) {
          done()
        })
      }
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
  // define the test data and output file
  var inFile = path.join('test', 'input', 'simpleData.json')
    , opts = { 
        keyPrefix: "stringRowTest"      //prefix to attach to all keys
      , serverAddress: "localhost"  //address of redis server
      , serverPort: 6379     //port of redis server
      , redisOpts: {} 
      }
    , result = []
    , expected = "{\"A label\":\"56\",\"B label\":\"78\",\"C label\":\"90\"}"

  var rc = redis.createClient(opts.serverPort, opts.serverAddress, opts.redisOpts)

  var testStream = new RedisRowStream(opts)

  rc.on('ready', function(){
    rc.flushall( function (err) { 
      should.not.exist(err)
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
        setTimeout(check, 500) //need some time here so that pipelines can empty and whatnot 

      })
    })
  })
 
}

var hashRowTest = function (done) {
  // define the test data and output file
  var inFile = path.join('test', 'input', 'simpleData.json')
    , opts = { 
        keyPrefix: "hashRowTest"    // prefix to attach to all keys
      , structure: "hash"           // save into hash data type
      , serverAddress: "localhost"  // address of redis server
      , serverPort: 6379            // port of redis server
      , redisOpts: {} 
      }
    , result = []
    , expected = {"A label":"56","B label":"78","C label":"90"}

  var rc = redis.createClient(opts.serverPort, opts.serverAddress, opts.redisOpts)

  var testStream = new RedisRowStream(opts)

  rc.on('ready', function(){
    rc.flushall( function (err) { 
      should.not.exist(err)
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
        setTimeout(check, 500) //need some time here so that pipelines can empty and whatnot 

      })
    })
  })
 
}


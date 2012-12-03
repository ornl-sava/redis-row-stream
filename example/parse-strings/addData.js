/*jshint node:true, indent:2, globalstrict: true, asi: true, laxcomma: true, laxbreak: true */
/*global require:true, console:true */

var RedisRowStream = require('../../redis-row-stream.js')
  , RegexStream = require('regex-stream')

var input = require('fs').createReadStream('./data.txt', {encoding: 'utf-8'})
  , parser = {
      "regex": "^([\\S]+) ([\\S]+) ([\\S]+)"
    , "labels": ["A label", "B label", "C label"]
    , "delimiter": "\r\n|\n"
    }
  , regexStream = new RegexStream(parser)
  , opts = { 
      keyPrefix: "addData"
    , structure: "hash"
    , index: true
    , indexedFields: ["A label"]
    , verbose: true
    }
  , redisStream = new RedisRowStream(opts)

// pipe data from input file to the regexStream parser to redis pubsub
input.pipe(regexStream).pipe(redisStream)


// test the index
var search = reds.createSearch('search')
search
  .query(query = 'first')
  .end(function(err, ids){
    if (err) throw err
    console.log('Search results for "%s":', query)
    ids.forEach(function(id){
      console.log('  - %s', strs[id])
    })
    process.exit();
  })
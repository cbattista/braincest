//populate_db.js

neo4j = require('node-neo4j');
require('./config.js');
var csv = require('csv-parser');
var fs = require('fs');
var fs = require('fs.extra');
var spawnSync = require('child_process').spawnSync;
var exec = require('child_process').exec;
var ncbi = require('node-ncbi');
var glob = require('glob');
var xml2json = require("node-xml2json");
var bibtex_parser = require("bibtex-parser");

function readBibtex() {
  fs.readFile('./pdfs/braincest_numcog.bib', function(err, data) {
      bibtex_json = bibtex_parser(data.toString());
      //now create some paper objects in neo4j
      //console.log(bibtex_json);

      for (var item in bibtex_json) {
        j = bibtex_json[item]['JOURNAL'];
        a = bibtex_json[item]['AUTHOR'].split(', ')[0];
        d = bibtex_json[item]['DOI'];
        y = bibtex_json[item]['YEAR'];
        f = bibtex_json[item]['FILE'].replace(/\{\\_\}/g, "_").replace(":Users", "/Users").replace(':pdf', '').replace(/ /g, "\\ ");
        t = bibtex_json[item]['TITLE'].replace('}', "").replace('{', "");

        db.insertNode({
            title: t,
            journal: j,
            first_author: a,
            doi: d,
            year: y,
            path: f,
        },function(err, node){
            if(err) throw err;
              // Output node properties.
              //console.log('Error creating node for');
              //console.log(node);
        });

    }

  });

}

function renamePDFs() {
  //rename the PDFs based on their DOIs to avoid all sort of problems
  db.cypherQuery("MATCH n WHERE n:Paper AND n:Core RETURN n", function(err, result){
    if(err) throw err;

    result.data.forEach( function (paper) {

      //glob for the paper path
      globstring = "/Users/christianbattista/braincest/pdfs/" + paper.journal + "*" + paper.first_author + "*" + paper.year + ".pdf"
      glob(globstring, function (er, files) {
        //if we find it, rename and put it in the vault
        if (files[0] != undefined) {
          new_name = paper.doi.replace('/', '_') + ".pdf";
          console.log(new_name);
          fs.copy(files[0], "/Users/christianbattista/braincest/pdfs/vault/" + new_name, { replace: true }, function (err) {
            if (err) {
              // i.e. file already exists or can't write to directory
              throw err;
            }
          });
        }

      });
    });
  });
}

function getCitations(path) {
  //get citations from a given paper
  pe = spawnSync('pdf-extract',  ['extract', '--references', path]);

  xml = pe.stdout.toString();
  var json = xml2json.parser(xml);
  if (json['pdf'] != undefined) {
    references = json['pdf']['reference'];
    return(json['pdf']['reference']);
  }

}

//for each core paper, get the citations
function findCitations() {
  var files = [];
  db.cypherQuery("MATCH n WHERE n:Paper AND n:Core RETURN n", function(err, result){
    if(err) throw err;

    result.data.forEach( function (paper) {
      path = paper.doi.replace('/', '_');
      path = '/Users/christianbattista/braincest/pdfs/vault/' + path + ".pdf";
      console.log(path);
      references = getCitations(path);
      console.log(references);
    });


  });
}


function getPubMed() {

  //CREATE HELPERS FOR PUBMED SEA
  var pm_search = require('node-ncbi/createGateway')({
      method: 'esearch',
      responseType: 'json',
      params: {
          db: 'pubmed',
          field: 'title',
      },
      test: false
  });

  var pm_fetch = require('node-ncbi/createGateway')({
      method: 'efetch',
      responseType: 'json',
      params: {
          db: 'pubmed'
      },
      test: false
  });


  pm_search.addParams({term: title});

  pm_search.send().then(function(doc) {
    console.log(doc);
    //idlist = doc['body']['esearchresult']['idlist'];
    //console.log(idlist[0]);
  });

  //var doc = require('node-ncbi/createNcbiDataDocument')(gateway);

  //console.log(doc)
}

//RUN STUFF
var db = new neo4j('http://' + username + ':' + password + '@localhost:7474');

/*
//READ IN THE CORE PAPERS (bibtex format exported from Mendeley)
//readBibtex();
//update db labels
db.cypherQuery("MATCH n SET n :Paper:Core RETURN n", function(err, result){
  if(err) throw err;
    //console.log('Error setting papers');
});
*/

//renamePDFs();

//GET THE REFERENCES
findCitations();

//r = getCitations('/Users/christianbattista/braincest/pdfs/vault/10.1016_j.actpsy.2012.02.005.pdf');
//console.log(r);

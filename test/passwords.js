/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let passwords = require("../lib/passwords");
let masterPassword = require("../lib/masterPassword");

let dummyMaster = "foobar";

let generated1 = {
  site: "example.com",
  name: "foo",
  length: 8,
  lower: true,
  upper: false,
  number: true,
  symbol: false,
  legacy: true,
  password: "r8hx8be6"
};

let generated2 = {
  site: "example.com",
  name: "bar",
  revision: "2",
  length: 16,
  lower: false,
  upper: true,
  number: false,
  symbol: true,
  password: "$X*RR~V}?;FY[T|~"
};

let stored1 = {
  site: "example.com",
  name: "foo",
  password: "bar"
};

let stored2 = {
  site: "example.com",
  name: "bar",
  password: "foo"
};

let stored3 = {
  site: "example.com",
  name: "bar",
  revision: "2",
  password: "foobar"
};

function expectedValue(expected, value)
{
  this.equal(value, expected);
}

function unexpectedError(error)
{
  this.ok(false, "Unexpected error: " + error);
  console.error(error);
}

function done()
{
  this.done();
}

exports.setUp = function(callback)
{
  let {storageData: storage} = require("../test-lib/browserAPI");
  for (let key of Object.keys(storage))
    delete storage[key];

  masterPassword.forgetPassword();

  callback();
};

exports.testAddRemoveGenerated = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);

    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    },
    {
      type: "generated",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);

    return Promise.all([
      pwdList,
      passwords.getPasswords(generated1.site),
      passwords.getPasswords("www." + generated1.site),
      passwords.getPasswords("www." + generated1.site + "."),
      passwords.getPasswords("sub." + generated1.site + ".")
    ]);
  }).then(([pwdList, siteData, wwwSiteData, wwwSiteData2, subSiteData]) =>
  {
    let [origSite, site, pwdList2] = siteData;
    test.equal(origSite, generated1.site);
    test.equal(site, generated1.site);
    test.deepEqual(pwdList2, pwdList);

    [origSite, site, pwdList2] = wwwSiteData;
    test.equal(origSite, generated1.site);
    test.equal(site, generated1.site);
    test.deepEqual(pwdList2, pwdList);
    test.deepEqual(wwwSiteData, wwwSiteData2);

    [origSite, site, pwdList2] = subSiteData;
    test.equal(origSite, "sub." + generated1.site);
    test.equal(site, "sub." + generated1.site);
    test.deepEqual(pwdList2, []);

    return passwords.removePassword(generated1.site, generated1.name, generated1.revision);
  }).catch(unexpectedError.bind(test)).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    }]);

    return passwords.removePassword(generated1.site, generated1.name, generated1.revision);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(() =>
  {
    return passwords.removePassword("sub." + generated2.site, generated2.name, "");
  }).then(() =>
  {
    test.ok(false, "Succeeded removing password with wrong revision number");
  }).catch(expectedValue.bind(test, "no-such-password")).then(() =>
  {
    return passwords.removePassword("sub." + generated2.site, generated2.name, generated2.revision);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(done.bind(test));
};

exports.testAddRemoveStored = function(test)
{
  Promise.resolve().then(() =>
  {
    return passwords.addStored(stored1);
  }).then(() =>
  {
    test.ok(false, "Added stored password before knowing master password");
  }).catch(expectedValue.bind(test, "master-password-required")).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addStored(stored1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);
    return passwords.addStored(stored2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return passwords.addStored(stored3);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password
    }, {
      type: "stored",
      site: stored3.site,
      name: stored3.name,
      revision: stored3.revision,
      password: stored3.password
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return Promise.all([
      pwdList,
      passwords.getPasswords(stored1.site),
      passwords.getPasswords("www." + stored1.site),
      passwords.getPasswords("www." + stored1.site + "."),
      passwords.getPasswords("sub." + stored1.site + ".")
    ]);
  }).then(([pwdList, siteData, wwwSiteData, wwwSiteData2, subSiteData]) =>
  {
    let [origSite, site, pwdList2] = siteData;
    test.equal(origSite, stored1.site);
    test.equal(site, stored1.site);
    test.deepEqual(pwdList2, pwdList);

    [origSite, site, pwdList2] = wwwSiteData;
    test.equal(origSite, stored1.site);
    test.equal(site, stored1.site);
    test.deepEqual(pwdList2, pwdList);
    test.deepEqual(wwwSiteData, wwwSiteData2);

    [origSite, site, pwdList2] = subSiteData;
    test.equal(origSite, "sub." + stored1.site);
    test.equal(site, "sub." + stored1.site);
    test.deepEqual(pwdList2, []);

    return passwords.removePassword(stored3.site, stored3.name, stored3.revision);
  }).catch(unexpectedError.bind(test)).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return passwords.removePassword(stored3.site, stored3.name, stored3.revision);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(() =>
  {
    return passwords.removePassword("sub." + stored2.site, stored2.name);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(done.bind(test));
};

exports.testAddGeneratedExisting = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).catch(unexpectedError.bind(test)).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    test.ok(false, "Succeeded adding the same password twice");
  }).catch(expectedValue.bind(test, "alreadyExists")).then(() =>
  {
    return passwords.addStored(stored1);
  }).catch(expectedValue.bind(test, "alreadyExists")).then(() =>
  {
    return passwords.removePassword(generated1.site, generated1.name, generated1.revision);
  }).then(() =>
  {
    return passwords.addStored(stored1);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testRetrieval = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.getPassword(generated1.site, generated1.name, generated1.revision);
  }).then(pwd =>
  {
    test.equal(pwd, generated1.password);
    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    return passwords.getPassword(generated2.site, generated2.name, generated2.revision);
  }).then(pwd =>
  {
    test.equal(pwd, generated2.password);
    return passwords.removePassword(generated2.site, generated2.name, generated2.revision);
  }).then(pwdList =>
  {
    return Promise.all([passwords.addStored(stored2), passwords.addStored(stored3)]);
  }).then(([pwdList1, pwdList2]) =>
  {
    return passwords.getPassword(stored2.site, stored2.name);
  }).then(pwd =>
  {
    test.equal(pwd, stored2.password);
    return passwords.getPassword(stored3.site, stored3.name, stored3.revision);
  }).then(pwd =>
  {
    test.equal(pwd, stored3.password);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAliases = function(test)
{
  let expectedSite = "example.info";
  function expectData(expectedAlias, expectedPwdList)
  {
    return passwords.getAlias(expectedSite).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getAlias("www." + expectedSite);
    }).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getAlias(expectedSite + ".");
    }).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getPasswords(expectedSite);
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);

      return passwords.getPasswords("www." + expectedSite);
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);

      return passwords.getPasswords(expectedSite + ".");
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);
    });
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    return expectData(expectedSite, []);
  }).then(() =>
  {
    return passwords.addAlias(expectedSite, generated1.site);
  }).then(() =>
  {
    return expectData(generated1.site, [{
      type: "generated",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);
  }).then(() =>
  {
    return passwords.removeAlias(expectedSite);
  }).then(() =>
  {
    return expectData(expectedSite, []);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAliasErrors = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    return passwords.addAlias(generated1.site, "example.info");
  }).then(() =>
  {
    test.ok(false, "Successfully added an alias for a site with passwords");
  }).catch(expectedValue.bind(test, "site-has-passwords")).then(() =>
  {
    return passwords.removeAlias(generated1.site);
  }).then(() =>
  {
    test.ok(false, "Successfully removed a non-existant alias");
  }).catch(expectedValue.bind(test, "no-such-alias")).then(() =>
  {
    return passwords.removeAlias("example.info");
  }).then(() =>
  {
    test.ok(false, "Successfully removed a non-existant alias");
  }).catch(expectedValue.bind(test, "no-such-alias")).then(done.bind(test));
};

exports.testNotes = function(test)
{
  let notes1 = "foobarnotes";
  let notes2 = "barbasnotes";

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated2);
  }).then(() =>
  {
    return passwords.setNotes(generated1.site, generated1.name, "", notes1);
  }).then(() =>
  {
    test.ok(false, "Successfully set notes on a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(() =>
  {
    return passwords.setNotes("sub." + generated2.site, generated2.name, generated2.revision, notes1);
  }).then(() =>
  {
    test.ok(false, "Successfully set notes on a non-existant password");
  }).catch(expectedValue.bind(test, "no-such-password")).then(() =>
  {
    return passwords.getNotes(generated2.site, generated2.name, generated2.revision);
  }).then(notes =>
  {
    test.equal(notes, null);

    return passwords.setNotes(generated2.site, generated2.name, generated2.revision, notes1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: notes1
    }]);

    return Promise.all([pwdList, passwords.getPasswords(generated2.site)]);
  }).then(([pwdList, [origSite, site, pwdList2]]) =>
  {
    test.deepEqual(pwdList2, pwdList);

    return passwords.getNotes(generated2.site, generated2.name, generated2.revision);
  }).then(notes =>
  {
    test.equal(notes, notes1);

    return passwords.setNotes(generated2.site, generated2.name, generated2.revision, notes2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: notes2
    }]);

    return passwords.getNotes(generated2.site, generated2.name, generated2.revision);
  }).then(notes =>
  {
    test.equal(notes, notes2);

    return passwords.setNotes(generated2.site, generated2.name, generated2.revision, null);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    }]);

    return Promise.all([pwdList, passwords.getPasswords(generated2.site)]);
  }).then(([pwdList, [origSite, site, pwdList2]]) =>
  {
    test.deepEqual(pwdList2, pwdList);

    return passwords.setNotes(generated2.site, generated2.name, generated2.revision, null);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    }]);
    return passwords.getNotes(generated2.site, generated2.name, generated2.revision);
  }).then(notes =>
  {
    test.equal(notes, null);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAllPasswords = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});

    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return passwords.addStored(stored2);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return Promise.all([
      passwords.addAlias("example.info", generated1.site),
      passwords.addAlias("sub1.example.info", generated1.site),
      passwords.addAlias("sub2.example.info", "sub." + generated2.site),
      passwords.addGenerated(Object.assign({}, generated2, {site: "sub." + generated2.site}))
    ]);
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      },
      ["sub." + generated2.site]: {
        site: "sub." + generated2.site,
        passwords: [{
          type: "generated2",
          site: "sub." + generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        }],
        aliases: ["sub2.example.info"]
      }
    });

    return passwords.setNotes(stored2.site, stored2.name, "", "foobarnotes");
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: "foobarnotes"
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      },
      ["sub." + generated2.site]: {
        site: "sub." + generated2.site,
        passwords: [{
          type: "generated2",
          site: "sub." + generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        }],
        aliases: ["sub2.example.info"]
      }
    });

    return passwords.removePassword("sub." + generated2.site, generated2.name, generated2.revision);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: "foobarnotes"
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testExport = function(test)
{
  function checkExport(test, exportData)
  {
    let parsed = JSON.parse(exportData);
    test.equal(parsed.application, "easypasswords");
    test.equal(parsed.format, 2);
    test.ok(typeof parsed.data == "object");
    test.ok(parsed.data["salt"]);
    test.ok(parsed.data["hmac-secret"]);

    return passwords.removeAll().then(() =>
    {
      return passwords.importPasswordData(exportData);
    }).then(() =>
    {
      return passwords.getAllPasswords();
    });
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});

    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        },
        {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return Promise.all([
      passwords.addAlias("example.info", generated1.site),
      passwords.addStored(stored2)
    ]);
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password
        }, {
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info"]
      }
    });

    return passwords.setNotes(generated2.site, generated2.name, generated2.revision, "foobarnotes");
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    return passwords.getNotes(generated2.site, generated2.name, generated2.revision);
  }).then(notes =>
  {
    test.equal(notes, "foobarnotes");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testDecryptingImport = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    let atob = str => new Buffer(str, "base64").toString("binary");
    let btoa = str => new Buffer(str, "binary").toString("base64");
    let salt = "asdf";
    let hmacSecret = "fdsa";
    let key = "4MgE2P1PbjLyAz7JxczGjOPNtaaqNKofAmGSbNvRtUM=";
    let iv = "fakeivwhatever";
    let cryptoPrefix = "AES-GCM!" + atob(key) + "!" + iv + "!";
    let hmacPrefix = "HMAC!" + hmacSecret + "!";
    let encrypt = data => btoa(iv) + "_" + btoa(cryptoPrefix + JSON.stringify(data));
    let digest = data => btoa(hmacPrefix + data);

    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 2,
      data: {
        salt: btoa(salt),
        "hmac-secret": encrypt(hmacSecret),
        [`site:${digest(generated1.site)}`]: encrypt({
          site: generated1.site
        }),
        [`site:${digest(generated1.site)}:${digest(generated1.site + "\0" + generated1.name + "\0")}`]: encrypt({
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }),
        [`site:${digest(generated2.site)}:${digest(generated2.site + "\0" + generated2.name + "\0" + generated2.revision)}`]: encrypt({
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        }),
        [`site:${digest("sub." + generated1.site)}`]: encrypt({
          site: "sub." + generated1.site,
          alias: generated1.site
        })
      }
    }));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        },
        {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["sub." + generated1.site]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testLegacyImport = function(test)
{
  let nodeCrypto = require("crypto");
  function getKey(salt)
  {
    return nodeCrypto.pbkdf2Sync(dummyMaster, salt, 256 * 1024, 32, "sha1").toString("binary");
  }

  let iv = "abcdefgh";
  let btoa = str => new Buffer(str, "binary").toString("base64");

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 1,
      sites: {
        [generated1.site]: {
          passwords: {
            [generated1.name]: {
              type: "pbkdf2-sha1-generated",
              length: generated1.length,
              lower: generated1.lower,
              upper: generated1.upper,
              number: generated1.number,
              symbol: generated1.symbol
            }
          },
          aliases: []
        }
      }
    }));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          revision: "",
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });
  }).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 1,
      sites: {
        [generated1.site]: {
          passwords: {
            [generated1.name]: {
              type: "pbkdf2-sha1-generated",
              length: generated1.length,
              lower: generated1.lower,
              upper: generated1.upper,
              number: generated1.number,
              symbol: generated1.symbol
            },
            [generated2.name + "\n" + generated2.revision]: {
              type: "generated",
              length: generated2.length,
              lower: generated2.lower,
              upper: generated2.upper,
              number: generated2.number,
              symbol: generated2.symbol,
              notes: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${generated2.site}\0${generated2.name}\0${generated2.revision}\0notes`) + `!${iv}!some notes here`)
            },
            [stored2.name]: {
              type: "pbkdf2-sha1-aes256-encrypted",
              password: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${stored2.site}\0${stored2.name}`) + `!${iv}!${stored2.password}`)
            }
          },
          aliases: ["example.info"]
        }
      }
    }));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "",
          password: stored2.password
        }, {
          type: "generated",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: "some notes here"
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          revision: "",
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info"]
      }
    });
  }).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 1,
      sites: {
        [stored1.site]: {
          passwords: {
            [stored1.name]: {
              type: "stored",
              password: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${stored1.site}\0${stored1.name}`) + `!${iv}!${stored1.password}`)
            }
          }
        }
      }
    }));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "",
          password: stored2.password
        }, {
          type: "generated",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: "some notes here"
        }, {
          type: "stored",
          site: stored1.site,
          name: stored1.name,
          revision: "",
          password: stored1.password
        }],
        aliases: ["example.info"]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testLastPassImport = function(test)
{
  function genCSV(entries)
  {
    return "url,username,password,extra,name,grouping,fav" +
      "\n" + entries.map(entry => entry.join(",")).join("\n");
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.importPasswordData(
      genCSV([["http://example.com", 2, 3, 4, 5, 6, 7],
              ["http://example.com", "bar"]])
    );
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV which has the wrong number of values.");
  }).catch(expectedValue.bind(test, "csv-wrong-number-of-values")).then(() =>
  {
    return passwords.importPasswordData(
      genCSV([["http://example.com", 2, 3, 4, "\"5", 6, 7]])
    );
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV with dangling quote.");
  }).catch(expectedValue.bind(test, "csv-unclosed-quote")).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});
  }).then(() =>
  {
    return passwords.importPasswordData(genCSV([
      ["http://a.com", "user", "password", "note", "name", "", ""],
      ["http://a.com", "user", "another password", "", "another name", "", ""],
      ["http://a.com", "anotheruser", "password", "", "name", "", ""],
      ["", "user", "password", "note", "b.com", "", ""],
      ["junk", "user", "password", "note", "c.com", "", ""],
      ["", "user", "password", "note", "dcom", "", ""],
      ["", "user", "password", "note", "e.com/path", "", ""],
      ["", "user", "password", "note", "This is f.com", "", ""],
      ["http://sn", "user", "password", "note", "g.com", "", ""],
      ["http://www.h.com.", "user", "password", "note", "", "", ""],
      ["http://i.com", "", "", "note", "name", "", ""],
      ["http://j.com", "", "password", "note", "name", "", ""],
      ["http://k.com", "", "password", "", "name", "", ""],
      ["http://l.com", "user", "", "", "name", "", ""],
      ["https://m.m.com/path?query", "user", "password", "before\"in\nside\"\"&amp;&lt;&gt;\"after&amp;lt;", "name", "", ""]
    ]));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      "m.m.com": {
        site: "m.m.com",
        passwords: [{
          site: "m.m.com",
          type: "stored",
          name: "user",
          password: "password",
          notes: "beforein\nside\"&<>after&lt;"
        }],
        aliases: []
      },
      // FIXME - Should a site with no entries be listed?
      // "l.com": {
      //   site: "l.com",
      //   passwords: [],
      //   aliases: []
      // },
      "k.com": {
        site: "k.com",
        passwords: [{
          site: "k.com",
          type: "stored",
          name: "",
          password: "password"
        }],
        aliases: []
      },
      "j.com": {
        site: "j.com",
        passwords: [{
          site: "j.com",
          type: "stored",
          name: "",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "i.com": {
        site: "i.com",
        passwords: [{
          site: "i.com",
          type: "stored",
          name: "name",
          password: "",
          notes: "note"
        }],
        aliases: []
      },
      "h.com": {
        site: "h.com",
        passwords: [{
          site: "h.com",
          type: "stored",
          name: "user",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "easypasswords.invalid": {
        site: "easypasswords.invalid",
        passwords: [{
          site: "easypasswords.invalid",
          type: "stored",
          name: "user",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "c.com": {
        site: "c.com",
        passwords: [{
          site: "c.com",
          type: "stored",
          name: "user",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "b.com": {
        site: "b.com",
        passwords: [{
          site: "b.com",
          type: "stored",
          name: "user",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "a.com": {
        site: "a.com",
        passwords: [{
          site: "a.com",
          type: "stored",
          name: "anotheruser",
          password: "password"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          password: "another password"
          // FIXME - Should an overwritten password not inherit the note?
          // notes: "note"
        }],
        aliases: []
      }
    });
  }).then(done.bind(test));
};

exports.testImportErrors = function(test)
{
  Promise.resolve().then(() =>
  {
    return passwords.importPasswordData("foobar");
  }).then(() =>
  {
    test.ok(false, "Imported malformed JSON");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify(42));
  }).then(() =>
  {
    test.ok(false, "Imported non-object");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "foobar",
      format: 2,
      data: {
        salt: "asdf",
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported unknown application data");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 33,
      data: {
        salt: "asdf",
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported unknown format version");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 2,
      data: null
    }));
  }).then(() =>
  {
    test.ok(false, "Imported null data");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 2,
      data: {}
    }));
  }).then(() =>
  {
    test.ok(false, "Imported empty data");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 2,
      data: {
        salt: "asdf"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data without HMAC secret");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 2,
      data: {
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data without salt");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 1,
      sites: null
    }));
  }).then(() =>
  {
    test.ok(false, "Imported legacy null data");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "easypasswords",
      format: 1,
      sites: 12
    }));
  }).then(() =>
  {
    test.ok(false, "Imported legacy non-object data");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(() =>
  {
    return passwords.importPasswordData("url,username,password");
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV with incorrect header");
  }).catch(expectedValue.bind(test, "unknown-data-format")).then(done.bind(test));
};

exports.testRemoveAll = function(test)
{
  function addData()
  {
    return Promise.all([
      passwords.addGenerated(generated1),
      passwords.addStored(stored2),
      passwords.addGenerated(Object.assign({}, generated2, {site: "sub." + generated2.site})),
      passwords.addAlias("example.info", generated1.site)
    ]);
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return addData();
  }).then(() =>
  {
    return passwords.removeAll();
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});

    return addData();
  }).then(() =>
  {
    return masterPassword.changePassword(dummyMaster + dummyMaster);
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testMigration = function(test)
{
  let nodeCrypto = require("crypto");
  function getKey(salt)
  {
    return nodeCrypto.pbkdf2Sync(dummyMaster, salt, 256 * 1024, 32, "sha1").toString("binary");
  }

  function getPasswordHash(salt)
  {
    let chars = "abcdefghjkmnpqrstuvwxyz";
    let key = getKey("\0" + salt);
    return chars[key.charCodeAt(0) % chars.length] + chars[key.charCodeAt(1) % chars.length];
  }

  let iv = "abcdefgh";
  let btoa = str => new Buffer(str, "binary").toString("base64");

  let {storageData} = require("../test-lib/browserAPI");
  storageData.masterPassword = {salt: "abcd"};
  storageData.masterPassword.hash = getPasswordHash(storageData.masterPassword.salt);

  storageData[`site:${generated1.site}`] = {
    passwords: {
      [generated1.name]: {
        type: "generated",
        length: generated1.length,
        lower: generated1.lower,
        upper: generated1.upper,
        number: generated1.number,
        symbol: generated1.symbol
      },
      [generated2.name + "\n" + generated2.revision]: {
        type: "generated",
        length: generated2.length,
        lower: generated2.lower,
        upper: generated2.upper,
        number: generated2.number,
        symbol: generated2.symbol,
        notes: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${generated2.site}\0${generated2.name}\0${generated2.revision}\0notes`) + `!${iv}!some notes here`)
      },
      [stored2.name]: {
        type: "stored",
        password: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${stored2.site}\0${stored2.name}`) + `!${iv}!${stored2.password}`),
        notes: `${btoa(iv)}_` + btoa("AES-CBC!" + getKey(`${stored2.site}\0${stored2.name}\0\0notes`) + `!${iv}!some more notes here`)
      }
    }
  };

  storageData["site:example.info"] = {
    alias: generated1.site
  };

  let origKeys = Object.keys(storageData);

  Promise.resolve().then(() =>
  {
    return masterPassword.checkPassword(dummyMaster);
  }).then(() =>
  {
    test.ok(false, "Checking master password didn't trigger migration");
  }).catch(expectedValue.bind(test, "migrating")).then(() =>
  {
    function checkState()
    {
      return masterPassword.state.then(state =>
      {
        if (state != "migrating")
          return state;

        return new Promise((resolve, reject) =>
        {
          setTimeout(() =>
          {
            resolve(checkState());
          }, 10);
        });
      });
    }

    return checkState();
  }).then(expectedValue.bind(test, "known")).then(() =>
  {
    for (let key of origKeys)
      test.ok(!(key in storageData), `Key ${key} removed from storage`);

    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "",
          password: stored2.password,
          notes: "some more notes here"
        }, {
          type: "generated",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: "some notes here"
        }, {
          type: "generated",
          site: generated1.site,
          name: generated1.name,
          revision: "",
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info"]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

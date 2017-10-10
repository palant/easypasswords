/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global document */

const parseURL = require("url").parse;
const {encryptPassword} = require("./crypto");
let masterPassword = require("./masterPassword");

const header = "url,username,password,extra,name,grouping,fav";

// If the Lastpass binary component is installed the CSV file is saved directly.
// Otherwise some JavaScript creates a pre element and assigns the contents to
// its innerHTML which has the side-effect of encoding HMTL entities. We assume
// encoding happened, but if it didn't passwords or notes containing entities
// will unfortunately be corrupted.
// http://stackoverflow.com/a/7394787/1226469
function decodeHTMLEntities(encoded)
{
  let textarea = document.createElement("textarea");
  textarea.innerHTML = encoded;
  return textarea.value;
}

function parseCSV(fileContents)
{
  const expectedValueCount = header.split(",").length;

  let entries = [];
  let currentEntry = [];
  let currentValue = "";
  let currentlyQuoted = false;
  let currentLine = 0;

  fileContents = fileContents.trim() + "\n";

  for (let i = 0; i < fileContents.length; i++)
  {
    let currentChar = fileContents[i];
    switch (currentChar)
    {
      case "\"":
        if (!currentlyQuoted)
          currentlyQuoted = true;
        else if (i + 1 < fileContents.length &&
                 fileContents[i + 1] == "\"")
        {
          currentValue += currentChar;
          i++;
        }
        else
          currentlyQuoted = false;
        break;
      case ",":
        if (!currentlyQuoted)
        {
          currentEntry.push(currentValue);
          currentValue = "";
        }
        else
          currentValue += currentChar;
        break;
      case "\n":
        if (!currentlyQuoted)
        {
          currentEntry.push(currentValue);
          currentValue = "";
          if (currentEntry.length != expectedValueCount)
          {
            throw new Error(
              "Line " + currentLine + ": Wrong number of values for entry. " +
              "Saw " + currentEntry.length + ", but expected " +
              expectedValueCount + "."
            );
          }
          entries.push(currentEntry);
          currentEntry = [];
        }
        else
          currentValue += currentChar;
        currentLine++;
        break;
      default:
        currentValue += currentChar;
    }
  }

  if (currentlyQuoted)
  {
    throw new Error(
      "Syntax error, quotation mark was opened but never closed!"
    );
  }

  return entries;
}

/* Parse a string containing the contents of a Lastpass CSV export.
 * If it doesn't look like a Lastpass CSV then we return null, but if it does
 * but there are problems we'll throw an exception.
 * @fileContents {string}
 * @return {?Object}
 */
function parseLastpassCSV(fileContents)
{
  // Quick sanity check, does this file have the right header?
  if (!fileContents.trim().startsWith(header + "\n"))
    return null;

  let master = masterPassword.get();
  if (!master)
    throw "master-password-required";

  let encryptionTasks = [];

  let data = {
    application: "easypasswords",
    format: 1,
    sites: {}
  };

  let entries = parseCSV(decodeHTMLEntities(fileContents));
  for (let i = 1; i < entries.length; i++)
  {
    let [url, username, password, extra, name, grouping, fav] = entries[i];

    // FIXME - Perhaps we should treat the secure note URL of "http://sn" as
    //         a special case, rather than having loads of entries with the
    //         domain of "sn"?

    // FIXME - Perhaps we should use .host rather than hostname?
    // FIXME - Do we really want to import potentially bogus hostnames?!
    let domain = parseURL(url).hostname || url || "easypasswords.invalid";

    // FIXME - Duplicated from _normalizeSite in passwords.js, since we don't
    //         want a circular dependency.
    if (domain.substr(0, 4) == "www.")
      domain = domain.substr(4);

    if (!(domain in data.sites))
      data.sites[domain] = {passwords: {}};

    // FIXME - What should we do about it if the Lastpass data has two passwords
    //         for the same domain + user combo?!
    if (username in data.sites[domain])
    {
      throw new Error(
        "Multiple records for domain: " + domain + ", user: " + username + "."
      );
    }

    if (!name)
    {
      throw new Error(
        "One or more entries have an empty name, which Lastpass doesn't allow."
      );
    }

    // FIXME - The name field isn't supported by Easy Passwords but we
    //         can't simply just drop it, since it's pretty important...
    let passwordEntry = {name};

    if (extra.length)
    {
      let params = {
        domain,
        masterPassword: master,
        name: username + "\0\0notes",
        password: extra
      };
      encryptionTasks.push(encryptPassword(params).then(encrypted =>
      {
        passwordEntry.notes = encrypted;
      }));
    }

    if (password.length)
    {
      let params = {
        domain,
        masterPassword: master,
        name: username,
        password
      };

      encryptionTasks.push(encryptPassword(params).then(encrypted =>
      {
        passwordEntry.type = "stored";
        passwordEntry.password = encrypted;
      }));
    }

    // FIXME - The username is not given for secure notes which aren't
    //         associated with password. What should we use instead?
    //         Is using a blank string OK?
    data.sites[domain].passwords[username] = passwordEntry;
  }

  // FIXME - This takes ages for my password vault. After I click to import it
  //         seems like nothing is happening while the passwords are encrypting.
  return Promise.all(encryptionTasks).then(() => data);
}

exports.header = header;
exports.parseCSV = parseCSV;
exports.parseLastpassCSV = parseLastpassCSV;


# wraps-gdata

Eventually, this should become a collection of [RingoJS](http://ringojs.org/) convenience wrappers for the [Google APIs based on GData](http://code.google.com/apis/gdata/docs/directory.html).

Currently, a wrapper for the [Google Spreadsheets Data API](http://code.google.com/apis/spreadsheets/) is implemented.

## Google Spreadsheets Data API

### Locators

Spreadsheets and the worksheets contained therein are identified by either

- a string containing the spreadsheet key (in this case, the first worksheet is assumed as default) or
- an object of the form `{key: ..., title: ..., projection: ..., visibility: ...}`.

In the latter case, `title` corresponds to either the title of the worksheet or its numeric index.

    var key = "0AhnIlyZzlLgWdHFYUTNiTUlGZG5TUmdyMmVvTnpDNFE";
    var locator = {key: key, title: 0};

### Unauthenticated use (for public spreadsheets)

In order to access a public spreadsheet programmatically, you need to start publishing (see: "Share > Publish to web") first.

    // lists assume that the worksheet contains headings
    var listValues = require("wraps/gdata/spreadsheet").getListValues(locator);
    // [{"name":"ringo","age":"69"},{"name":"paul","age":"67"}]
    
    var cellValues = require("wraps/gdata/spreadsheet").getCellValues(locator);
    // {"1":{"1":"name","2":"age"},"2":{"1":"ringo","2":69},"3":{"1":"paul","2":67}}
    // NB: 1-based indexing

### Authenticated use

    var service = require("wraps/gdata/spreadsheet").Service(appName, user, password);
    var values = service.getListValues(locator); // or: service.getCellValues(locator);

### List wrapper

    var list = service.getAsList(locator);
    list.update(0, {name: "ringojs", age: 0}); // NB: 0-based indexing
    list.append({name: "helma-ng", age: 2});
    var values = list.values();
    list.refresh(); // if the list may have changed externally

### Batch updates

(Caveat: For some reason, those don't seem to process much faster than individual calls.)

    service.updateCellValues(locator, cellValues);

## License

wraps-gdata is available under the same license as RingoJS.

The components of the [GData Java Client Library](http://code.google.com/p/gdata-java-client/) bundled in this package are licensed under the Apache License 2.0.
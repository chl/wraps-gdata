var gdata = com.google.gdata;
var client = gdata.client;
var data = gdata.data;
var batch = data.batch;

export("Service", "getCellValues", "getListValues");

function getCellValues(locator) {
    return new Service().getCellValues(locator);
}

function getListValues(locator) {
    return new Service().getListValues(locator);
}

function Service(appName, user, password) {
    if (!(this instanceof Service))
        return new Service(appName || "wraps/gdata/spreadsheet", user, password);
    this.service = new client.spreadsheet.SpreadsheetService(appName);
    if (user && password) {
        this.service.setUserCredentials(user, password);
        this.authenticated = true;
    }
    this.service.setProtocolVersion(client.spreadsheet.SpreadsheetService.Versions.V1); // @@ revisit
    this.urlFactory = client.spreadsheet.FeedURLFactory.getDefault();
}

Service.prototype.getSpreadsheetFeed = function() {
    return this.service.getFeed(
        this.urlFactory.spreadsheetsFeedUrl,
        data.spreadsheet.SpreadsheetFeed
    );
};

Service.prototype.getWorksheetFeed = function(locator) {
    var {key, visibility, projection} = locator.key ? locator : {key: locator};
    return this.service.getFeed(
        this.urlFactory.getWorksheetFeedUrl(
            key,
            visibility || (this.authenticated ? "private" : "public"),
            projection || (this.authenticated ? "full" : "values")
        ),
        data.spreadsheet.WorksheetFeed
    );
};

Service.prototype.getWorksheetEntry = function(locator) {
    var feed = this.getWorksheetFeed(locator);
    var sheet = locator.sheet === undefined ? 0 : locator.sheet;
    var entries = ScriptableList(feed.entries);
    for (let i in entries) {
        let entry = entries[i];
        if ((entry.title && entry.title.text == sheet) || (typeof sheet == "number" && sheet == i))
            return entry;
    }
    return null;
};

Service.prototype.cellFeedForEntry = function(worksheetEntry) {
    return this.service.getFeed(
        worksheetEntry.getCellFeedUrl(),
        data.spreadsheet.CellFeed
    );
};

Service.prototype.listFeedForEntry = function(worksheetEntry) {
    return this.service.getFeed(
        worksheetEntry.getListFeedUrl(),
        data.spreadsheet.ListFeed
    );
};

Service.prototype.getCellFeed = function(locator) {
    return this.cellFeedForEntry(this.getWorksheetEntry(locator));
};

Service.prototype.getListFeed = function(locator) {
    return this.listFeedForEntry(this.getWorksheetEntry(locator));
};

Service.prototype.getCellValues = function(locator) {
    var cells = {};
    for each (let entry in ScriptableList(this.getCellFeed(locator).entries)) {
        let cell = entry.cell;
        if (!cells[cell.row])
            cells[cell.row] = {};
        cells[cell.row][cell.col] = cell.numericValue === null ? cell.value : cell.numericValue;
    }
    return cells;
};

Service.prototype.updateCellValues = function(locator, cells) {
    var worksheetEntry = this.getWorksheetEntry(locator);
    var [rows, cols] = [worksheetEntry.getRowCount(), worksheetEntry.getColCount()];
    for (let [r, row] in cells) {
        r = parseInt(r, 10);
        if (r > rows)
            rows = r;
        for (let [c, v] in row) {
            c = parseInt(c, 10);
            if (c > cols)
                cols = c;
        }
    }
    worksheetEntry.setRowCount(rows);
    worksheetEntry.setColCount(cols);
    worksheetEntry.update();
    var cellQuery = new client.spreadsheet.CellQuery(worksheetEntry.getCellFeedUrl());
    cellQuery.setReturnEmpty(true);
    var feed = this.service.getFeed(cellQuery, data.spreadsheet.CellFeed);
    var batchFeed = new data.spreadsheet.CellFeed();
    for each (let entry in ScriptableList(feed.entries)) {
        let cell = entry.cell;
        entry.changeInputValueLocal((cells[cell.row] || {})[cell.col] || null);
        batch.BatchUtils.setBatchOperationType(entry, batch.BatchOperationType.UPDATE);
        batchFeed.entries.add(entry);
    }
    return this.service.batch(
        new java.net.URL(feed.getLink(
            data.ILink.Rel.FEED_BATCH,
            data.ILink.Type.ATOM
        ).href), 
        batchFeed
    );
};

Service.prototype.getAsList = function(locator) {
    return new List(this.getListFeed(locator), this.service);
};

Service.prototype.getListValues = function(locator) {
    return this.getAsList(locator).values();
};

function List(feed, service) {
    this.feed = feed;
    this.service = service;
}

List.prototype.get = function(row) {
    var object = {};
    var entry = this.feed.entries.get(row);
    for each (let tag in ScriptableList(entry.customElements.tags))
        object[tag] = entry.customElements.getValue(tag);
    return object;
};

List.prototype.values = function() {
    return [this.get(i) for (i in ScriptableList(this.feed.entries))];
};

List.prototype.update = function(row, object, refresh) {
    var entry = this.feed.entries.get(row);
    for (let [k, v] in object)
        entry.customElements.setValueLocal(k, v);
    entry.update();
    if (refresh !== false)
        this.refresh();
};

List.prototype.append = function(object, refresh) {
    var entry = new data.spreadsheet.ListEntry();
    for (let [k, v] in object)
        entry.customElements.setValueLocal(k, v);
    this.feed.insert(entry);
    if (refresh !== false)
        this.refresh();
};

List.prototype.refresh = function() {
    this.feed = this.service.getFeed(
        new java.net.URL(this.feed.getSelfLink().href),
        data.spreadsheet.ListFeed
    );
};

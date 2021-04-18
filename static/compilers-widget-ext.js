// Copyright (c) 2021, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

var _ = require('underscore'),
    local = require('./local'),
    $ = require('jquery');

function CompilersWidgetExt(langId, possibleCompilers, dropdownButton, state, onChangeCallback) {
    this.dropdownButton = dropdownButton;
    if (state.compiler) {
        this.currentCompilerId = state.compiler;
    } else {
        this.currentCompilerId = false;
    }
    this.currentLangId = langId;
    this.domRoot = $('#compiler-selection').clone(true);
    this.groupedResults = {};
    this.onChangeCallback = function () {
        this.updateButton();
        onChangeCallback();
    };
    this.availableCompilers = {};
    this.updateAvailableCompilers(possibleCompilers);

    this.fullRefresh();

    var searchInput = this.domRoot.find('.compiler-search-input');

    if (window.compilerExplorerOptions.mobileViewer) {
        this.domRoot.addClass('mobile');
    }

    this.domRoot.on('shown.bs.modal', function () {
        searchInput.trigger('focus');
    });

    searchInput.on('input', _.bind(function () {
        this.startSearching();
    }, this));

    this.domRoot.find('.compiler-search-button').on('click', _.bind(function () {
        this.startSearching();
    }, this));

    this.dropdownButton.on('click', _.bind(function () {
        this.domRoot.modal({});
    }, this));

    this.updateButton();
}

CompilersWidgetExt.prototype.fullRefresh = function () {
    this.showSelectedCompilers();
    this.showSelectedCompilersAsSearchResults();
    this.showFavorites();
};

CompilersWidgetExt.prototype.updateButton = function () {
    var selectedCompilers = this.get();
    if (selectedCompilers.length > 0) {
        this.dropdownButton.addClass('btn-success').removeClass('btn-light');
    } else {
        this.dropdownButton.removeClass('btn-success').addClass('btn-light');
    }
};

CompilersWidgetExt.prototype.getFavorites = function () {
    var storkey = 'favcompilers';

    return JSON.parse(local.get(storkey, '[]'));
};

CompilersWidgetExt.prototype.setFavorites = function (faves) {
    var storkey = 'favcompilers';

    local.set(storkey, JSON.stringify(faves));
};

CompilersWidgetExt.prototype.isAFavorite = function (compilerId) {
    var faves = this.getFavorites();
    return faves.includes(compilerId);
};

CompilersWidgetExt.prototype.addToFavorites = function (compilerId) {
    var faves = this.getFavorites();
    if (!faves.includes(compilerId)) {
        faves.push(compilerId);
    }

    this.setFavorites(faves);
};

CompilersWidgetExt.prototype.removeFromFavorites = function (compilerId) {
    var faves = this.getFavorites();
    if (faves.includes(compilerId)) {
        faves = faves.filter(function (id) {
            return (id !== compilerId);
        });
    }

    this.setFavorites(faves);
};

CompilersWidgetExt.prototype.newFavoriteCompilerDiv = function (compilerId, compiler) {
    var template = $('#compiler-favorite-tpl');

    var compilerDiv = $(template.children()[0].cloneNode(true));

    var quickSelectButton = compilerDiv.find('.compiler-name-and-version');
    quickSelectButton.html(compiler.name);
    quickSelectButton.on('click', _.bind(function () {
        this.selectCompilerAndVersion(compilerId);
        this.showSelectedCompilers();
        this.onChangeCallback();
    }, this));

    return compilerDiv;
};

CompilersWidgetExt.prototype.showFavorites = function () {
    var favoritesDiv = this.domRoot.find('.compiler-favorites');
    favoritesDiv.html('');

    var faves = this.getFavorites();
    _.each(faves, _.bind(function (compilerId) {
        var compiler = this.getCompilerInfoById(compilerId);
        if (compiler) {
            var div = this.newFavoriteCompilerDiv(compilerId, compiler);
            favoritesDiv.append(div);
        }
    }, this));
};

CompilersWidgetExt.prototype.getAndEmptySearchResults = function () {
    var searchResults = this.domRoot.find('.compiler-results-items');
    searchResults.html('');
    this.groupedResults = {};
    return searchResults;
};

CompilersWidgetExt.prototype.newSelectedCompilerDiv = function (compilerId, compiler) {
    var template = $('#compiler-selected-tpl');

    var compilerDiv = $(template.children()[0].cloneNode(true));

    var detailsButton = compilerDiv.find('.compiler-name-and-version');
    detailsButton.html(compiler.name);
    detailsButton.on('click', _.bind(function () {
        var searchResults = this.getAndEmptySearchResults();
        this.addSearchResult(compilerId, compiler, searchResults);
    }, this));

    var deleteButton = compilerDiv.find('.compiler-remove');
    deleteButton.on('click', _.bind(function () {
        //this.markCompiler(compilerId, versionId, false);
        compilerDiv.remove();
        this.showSelectedCompilers();
        this.onChangeCallback();
        // We need to refresh the compiler lists, or the selector will still show up with the old compiler version
        this.startSearching();
    }, this));

    return compilerDiv;
};

CompilersWidgetExt.prototype.conjureUpExamples = function (result, compiler) {
    var examples = result.find('.compiler-examples');
    if (compiler.examples && compiler.examples.length > 0) {
        var examplesHeader = $('<b>Examples</b>');
        var examplesList = $('<ul />');
        _.each(compiler.examples, function (exampleId) {
            var li = $('<li />');
            examplesList.append(li);
            var exampleLink = $('<a>Example</a>');
            exampleLink.attr('href', window.httpRoot + 'z/' + exampleId);
            exampleLink.attr('target', '_blank');
            exampleLink.attr('rel', 'noopener');
            li.append(exampleLink);
        });

        examples.append(examplesHeader);
        examples.append(examplesList);
    }
};

CompilersWidgetExt.prototype.newSearchResult = function (compilerId, compiler) {
    var template = $('#compiler-search-result-tpl');

    var result;
    var faveButton;
    var faveStar;
    var versions;

    if (compiler.groupName && !this.groupedResults[compiler.groupName]) {
        result = $(template.children()[0].cloneNode(true));
        result.find('.compiler-name').html(compiler.groupName);
        if (!compiler.description) {
            result.find('.compiler-description').hide();
        } else {
            result.find('.compiler-description').html(compiler.description);
        }

        this.conjureUpExamples(result, compiler);

        this.groupedResults[compiler.groupName] = {
            node: result,
        };

        faveButton = result.find('.compiler-fav-button');
        faveStar = faveButton.find('.compiler-fav-btn-icon');
        faveButton.hide();

        versions = result.find('.compiler-version-select');
        versions.html('');
        versions.append($('<option value="">-</option>'));
    } else {
        result = this.groupedResults[compiler.groupName].node;
        faveButton = result.find('.compiler-fav-button');
        faveStar = faveButton.find('.compiler-fav-btn-icon');
        versions = result.find('.compiler-version-select');
    }

    var isUsed = (compilerId === this.currentCompilerId);

    var option = $('<option>');
    if (isUsed) {
        option.attr('selected','selected');

        if (this.isAFavorite(compilerId)) {
            faveStar.removeClass('far').addClass('fas');
        }

        faveButton.show();
    }
    option.attr('value', compilerId);
    option.html(compiler.name);
    versions.append(option);

    faveButton.on('click', _.bind(function () {
        var option = versions.find('option:selected');
        var compilerId = option.attr('value');
        if (this.isAFavorite(compilerId)) {
            this.removeFromFavorites(compilerId);
            faveStar.removeClass('fas').addClass('far');
        } else {
            this.addToFavorites(compilerId);
            faveStar.removeClass('far').addClass('fas');
        }
        this.showFavorites();
    }, this));

    versions.on('change', _.bind(function () {
        var option = versions.find('option:selected');
        var verId = option.attr('value');

        this.selectCompilerAndVersion(compilerId);
        this.showSelectedCompilers();

        if (this.isAFavorite(compilerId)) {
            faveStar.removeClass('far').addClass('fas');
        } else {
            faveStar.removeClass('fas').addClass('far');
        }

        if (verId) {
            faveButton.show();
        } else {
            faveButton.hide();
        }

        this.onChangeCallback();
    }, this));

    return result;
};

CompilersWidgetExt.prototype.addSearchResult = function (compilerId, compiler, searchResults) {
    var card = this.newSearchResult(compilerId, compiler);
    searchResults.append(card);
};

CompilersWidgetExt.prototype.startSearching = function () {
    var searchtext = this.domRoot.find('.compiler-search-input').val();
    var lcSearchtext = searchtext.toLowerCase();

    var searchResults = this.getAndEmptySearchResults();

    if (Object.keys(this.availableCompilers[this.currentLangId]).length === 0) {
        var nocompilersMessage = $($('#compilers-dropdown').children()[0].cloneNode(true));
        searchResults.append(nocompilersMessage);
        return;
    }

    var descriptionSearchResults = [];

    _.each(this.availableCompilers[this.currentLangId], _.bind(function (compiler, compilerId) {
        if (compiler.versions && compiler.versions.autodetect) return;

        if (compiler.name) {
            if (compiler.name.toLowerCase().includes(lcSearchtext)) {
                this.addSearchResult(compilerId, compiler, searchResults);
                return;
            }
        }

        if (compiler.description) {
            if (compiler.description.toLowerCase().includes(lcSearchtext)) {

                descriptionSearchResults.push({
                    compilerId: compilerId,
                    compiler: compiler,
                    searchResults: searchResults,
                });
            }
        }
    }, this));

    _.each(descriptionSearchResults, _.bind(function (res) {
        this.addSearchResult(res.compilerId, res.compiler, res.searchResults);
    }, this));
};

CompilersWidgetExt.prototype.showSelectedCompilers = function () {
    var items = this.domRoot.find('.compilers-selected-items');
    items.html('');

    var selectedCompilers = this.listUsedCompilers();
    _.each(selectedCompilers, _.bind(function (compilerId) {
        var compiler = this.availableCompilers[this.currentLangId][compilerId];

        var compilerDiv = this.newSelectedCompilerDiv(compilerId, compiler);
        items.append(compilerDiv);
    }, this));
};

CompilersWidgetExt.prototype.showSelectedCompilersAsSearchResults = function () {
    var searchResults = this.getAndEmptySearchResults();

    if (Object.keys(this.availableCompilers[this.currentLangId]).length === 0) {
        var nocompilersMessage = $($('#compilers-dropdown').children()[0].cloneNode(true));
        searchResults.append(nocompilersMessage);
        return;
    }

    _.each(this.availableCompilers[this.currentLangId], _.bind(function (compiler, compilerId) {
        if (compiler.versions && compiler.versions.autodetect) return;

        var card = this.newSearchResult(compilerId, compiler);
        searchResults.append(card);
    }, this));
};

CompilersWidgetExt.prototype.updateAvailableCompilers = function (possibleCompilers) {
    if (!this.availableCompilers[this.currentLangId]) {
        this.availableCompilers[this.currentLangId] = possibleCompilers;
    }
};

CompilersWidgetExt.prototype.setNewLangId = function (langId, compilerId, possibleCompilers) {
    this.currentLangId = langId;
    this.currentCompilerId = compilerId;

    // Clear the dom Root so it gets rebuilt with the new language compilers
    this.updateAvailableCompilers(possibleCompilers);

    this.fullRefresh();
    this.onChangeCallback();
};

CompilersWidgetExt.prototype.getCompilerInfoById = function (compilerId) {
    if (this.availableCompilers[this.currentLangId]) {
        return this.availableCompilers[this.currentLangId][compilerId];
    }

    return false;
};

CompilersWidgetExt.prototype.selectCompilerAndVersion = function (compilerId) {
    this.currentCompilerId = compilerId;
};

CompilersWidgetExt.prototype.get = function () {
    return this.listUsedCompilers();
};

CompilersWidgetExt.prototype.listUsedCompilers = function () {
    if (this.currentCompilerId) {
        return [this.currentCompilerId];
    } else {
        return [];
    }
};

module.exports = {
    Widget: CompilersWidgetExt,
};

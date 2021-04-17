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

var options = require('options'),
    _ = require('underscore'),
    local = require('./local'),
    $ = require('jquery');

function CompilersWidgetExt(langId, possibleCompilers, dropdownButton, state, onChangeCallback) {
    this.dropdownButton = dropdownButton;
    if (state.compiler) {
        this.currentCompilerId = state.compiler;
    } else {
        this.currentCompilerId = '_default_';
    }
    this.currentLangId = langId;
    this.domRoot = $('#compiler-selection').clone(true);
    this.onChangeCallback = function () {
        this.updateButton();
        onChangeCallback();
    };
    this.availableCompilers = {};
    this.updateAvailableCompilers(possibleCompilers);
    _.each(state.compilers, _.bind(function (compiler) {
        if (compiler.name && compiler.ver) {
            this.markCompiler(compiler.name, compiler.ver, true);
        } else {
            this.markCompiler(compiler.id, compiler.version, true);
        }
    }, this));

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

    return JSON.parse(local.get(storkey, '{}'));
};

CompilersWidgetExt.prototype.setFavorites = function (faves) {
    var storkey = 'favcompilers';

    local.set(storkey, JSON.stringify(faves));
};

CompilersWidgetExt.prototype.isAFavorite = function (compilerId, versionId) {
    var faves = this.getFavorites();
    if (faves[compilerId]) {
        return faves[compilerId].includes(versionId);
    }

    return false;
};

CompilersWidgetExt.prototype.addToFavorites = function (compilerId, versionId) {
    var faves = this.getFavorites();
    if (faves[compilerId]) {
        faves[compilerId].push(versionId);
    } else {
        faves[compilerId] = [];
        faves[compilerId].push(versionId);
    }

    this.setFavorites(faves);
};

CompilersWidgetExt.prototype.removeFromFavorites = function (compilerId, versionId) {
    var faves = this.getFavorites();
    if (faves[compilerId]) {
        faves[compilerId] = _.filter(faves[compilerId], function (v) {
            return (v !== versionId);
        });
    }

    this.setFavorites(faves);
};

CompilersWidgetExt.prototype.newFavoriteCompilerDiv = function (compilerId, versionId, compiler, version) {
    var template = $('#compiler-favorite-tpl');

    var compilerDiv = $(template.children()[0].cloneNode(true));

    var quickSelectButton = compilerDiv.find('.compiler-name-and-version');
    quickSelectButton.html(compiler.name + ' ' + version.version);
    quickSelectButton.on('click', _.bind(function () {
        this.selectCompilerAndVersion(compilerId, versionId);
        this.showSelectedCompilers();
        this.onChangeCallback();
    }, this));

    return compilerDiv;
};

CompilersWidgetExt.prototype.showFavorites = function () {
    var favoritesDiv = this.domRoot.find('.compiler-favorites');
    favoritesDiv.html('');

    var faves = this.getFavorites();
    _.each(faves, _.bind(function (versionArr, compilerId) {
        _.each(versionArr, _.bind(function (versionId) {
            var compiler = this.getCompilerInfoById(compilerId);
            if (compiler) {
                var version = compiler.versions[versionId];
                if (version) {
                    var div = this.newFavoriteCompilerDiv(compilerId, versionId, compiler, version);
                    favoritesDiv.append(div);
                }
            }
        }, this));
    }, this));
};

CompilersWidgetExt.prototype.getAndEmptySearchResults = function () {
    var searchResults = this.domRoot.find('.compiler-results-items');
    searchResults.html('');
    return searchResults;
};

CompilersWidgetExt.prototype.newSelectedCompilerDiv = function (compilerId, versionId, compiler, version) {
    var template = $('#compiler-selected-tpl');

    var compilerDiv = $(template.children()[0].cloneNode(true));

    var detailsButton = compilerDiv.find('.compiler-name-and-version');
    detailsButton.html(compiler.name + ' ' + version.version);
    detailsButton.on('click', _.bind(function () {
        var searchResults = this.getAndEmptySearchResults();
        this.addSearchResult(compilerId, compiler, searchResults);
    }, this));

    var deleteButton = compilerDiv.find('.compiler-remove');
    deleteButton.on('click', _.bind(function () {
        this.markCompiler(compilerId, versionId, false);
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

    var result = $(template.children()[0].cloneNode(true));
    result.find('.compiler-name').html(compiler.name);
    if (!compiler.description) {
        result.find('.compiler-description').hide();
    } else {
        result.find('.compiler-description').html(compiler.description);
    }
    result.find('.compiler-website-link').attr('href', compiler.url ? compiler.url : '#');

    this.conjureUpExamples(result, compiler);

    var faveButton = result.find('.compiler-fav-button');
    var faveStar = faveButton.find('.compiler-fav-btn-icon');
    faveButton.hide();

    var versions = result.find('.compiler-version-select');
    versions.html('');
    versions.append($('<option value="">-</option>'));
    _.each(compiler.versions, _.bind(function (version, versionId) {
        var option = $('<option>');
        if (version.used) {
            option.attr('selected','selected');

            if (this.isAFavorite(compilerId, versionId)) {
                faveStar.removeClass('far').addClass('fas');
            }

            faveButton.show();
        }
        option.attr('value', versionId);
        option.html(version.version);
        versions.append(option);
    }, this));

    faveButton.on('click', _.bind(function () {
        var option = versions.find('option:selected');
        var verId = option.attr('value');
        if (this.isAFavorite(compilerId, verId)) {
            this.removeFromFavorites(compilerId, verId);
            faveStar.removeClass('fas').addClass('far');
        } else {
            this.addToFavorites(compilerId, verId);
            faveStar.removeClass('far').addClass('fas');
        }
        this.showFavorites();
    }, this));

    versions.on('change', _.bind(function () {
        var option = versions.find('option:selected');
        var verId = option.attr('value');

        this.selectCompilerAndVersion(compilerId, verId);
        this.showSelectedCompilers();

        if (this.isAFavorite(compilerId, verId)) {
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
    _.each(selectedCompilers, _.bind(function (versionId, compilerId) {
        var compiler = this.availableCompilers[this.currentLangId][compilerId];
        var version = compiler.versions[versionId];

        var compilerDiv = this.newSelectedCompilerDiv(compilerId, versionId, compiler, version);
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

CompilersWidgetExt.prototype.initLangDefaultCompilers = function () {
    var defaultCompiler = options.defaultCompiler[this.currentLangId];
    if (!defaultCompiler) return;
    _.each(defaultCompiler.split(':'), _.bind(function (compilerPair) {
        var pairSplits = compilerPair.split('.');
        if (pairSplits.length === 2) {
            var compiler = pairSplits[0];
            var ver = pairSplits[1];
            this.markCompiler(compiler, ver, true);
        }
    }, this));
};

CompilersWidgetExt.prototype.updateAvailableCompilers = function (possibleCompilers) {
    if (!this.availableCompilers[this.currentLangId]) {
        this.availableCompilers[this.currentLangId] = {};
    }

    if (!this.availableCompilers[this.currentLangId][this.currentCompilerId]) {
        if (this.currentCompilerId === '_default_') {
            this.availableCompilers[this.currentLangId] =
                $.extend(true, {}, options.compilers[this.currentLangId]);
        } else {
            this.availableCompilers[this.currentLangId] =
                $.extend(true, {}, possibleCompilers);
        }
    }

    this.initLangDefaultCompilers();
};

CompilersWidgetExt.prototype.setNewLangId = function (langId, compilerId, possibleCompilers) {
    var compilersInUse = this.listUsedCompilers();

    this.currentLangId = langId;

    if (compilerId) {
        this.currentCompilerId = compilerId;
    } else {
        this.currentCompilerId = '_default_';
    }

    // Clear the dom Root so it gets rebuilt with the new language compilers
    this.updateAvailableCompilers(possibleCompilers);

    _.forEach(compilersInUse, _.bind(function (version, compiler) {
        this.markCompiler(compiler, version, true);
    }, this));

    this.fullRefresh();
    this.onChangeCallback();
};

CompilersWidgetExt.prototype.getVersionOrAlias = function (name, version) {
    if (this.availableCompilers[this.currentLangId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId][name]) {
        if (this.availableCompilers[this.currentLangId][this.currentCompilerId][name].versions[version]) {
            return version;
        } else {
            return _.findKey(
                this.availableCompilers[this.currentLangId][this.currentCompilerId][name].versions,
                function (ver) {
                    return ver.alias && ver.alias.includes(version);
                });
        }
    }
};

CompilersWidgetExt.prototype.getCompilerInfoById = function (compilerId) {
    if (this.availableCompilers[this.currentLangId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId][compilerId]) {
        return this.availableCompilers[this.currentLangId][this.currentCompilerId][compilerId];
    }

    return false;
};

CompilersWidgetExt.prototype.markCompiler = function (name, version, used) {
    var actualVersion = this.getVersionOrAlias(name, version);

    if (this.availableCompilers[this.currentLangId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId][name] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId][name].versions[actualVersion]) {
        this.availableCompilers[this.currentLangId][this.currentCompilerId][name].versions[actualVersion].used = used;
    }
};

CompilersWidgetExt.prototype.selectCompilerAndVersion = function (compilerId, versionId) {
    if (this.availableCompilers[this.currentLangId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId] &&
        this.availableCompilers[this.currentLangId][this.currentCompilerId][compilerId]) {

        _.each(
            this.availableCompilers[this.currentLangId][this.currentCompilerId][compilerId].versions,
            function (curver, curverId) {
                curver.used = curverId === versionId;
            });
    }
};

CompilersWidgetExt.prototype.get = function () {
    return _.map(this.listUsedCompilers(), function (item, compilerId) {
        return {name: compilerId, ver: item};
    });
};

CompilersWidgetExt.prototype.listUsedCompilers = function () {
    var compilers = {};
    _.each(this.availableCompilers[this.currentLangId][this.currentCompilerId], function (compiler, compilerId) {
        _.each(compiler.versions, function (version, ver) {
            if (compiler.versions[ver].used) {
                // We trust the invariant of only 1 used version at any given time per compiler
                compilers[compilerId] = ver;
            }
        });
    });
    return compilers;
};

CompilersWidgetExt.prototype.getCompilersInUse = function () {
    var compilers = [];
    _.each(this.availableCompilers[this.currentLangId][this.currentCompilerId], function (compiler, compilerId) {
        _.each(compiler.versions, function (version, ver) {
            if (compiler.versions[ver].used) {
                var compilerVer = Object.assign({compilerId: compilerId, versionId: ver}, compiler.versions[ver]);
                compilers.push(compilerVer);
            }
        });
    });
    return compilers;
};

module.exports = {
    Widget: CompilersWidgetExt,
};

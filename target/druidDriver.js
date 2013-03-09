// Generated by CoffeeScript 1.3.1
(function() {
  var addApplies, andFilters, async, driverUtil, druidQuery, exports, findApply, findCountApply, makeFilter, rq, toDruidInterval,
    __slice = [].slice;

  rq = function(module) {
    var moduleParts;
    if (typeof window === 'undefined') {
      return require(module);
    } else {
      moduleParts = module.split('/');
      return window[moduleParts[moduleParts.length - 1]];
    }
  };

  async = rq('async');

  driverUtil = rq('./driverUtil');

  if (typeof exports === 'undefined') {
    exports = {};
  }

  makeFilter = function(attribute, value) {
    return {
      type: 'selector',
      dimension: attribute,
      value: value
    };
  };

  andFilters = function() {
    var filters;
    filters = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    filters = filters.filter(function(filter) {
      return filter != null;
    });
    switch (filters.length) {
      case 0:
        return null;
      case 1:
        return filters[0];
      default:
        return {
          type: 'and',
          fields: filters
        };
    }
  };

  findApply = function(applies, propName) {
    var apply, _i, _len;
    for (_i = 0, _len = applies.length; _i < _len; _i++) {
      apply = applies[_i];
      if (apply.prop === propName) {
        return apply;
      }
    }
  };

  findCountApply = function(applies) {
    var apply, _i, _len;
    for (_i = 0, _len = applies.length; _i < _len; _i++) {
      apply = applies[_i];
      if (apply.aggregate === 'count') {
        return apply;
      }
    }
  };

  toDruidInterval = function(interval) {
    return interval.map(function(d) {
      return d.toISOString().replace('Z', '');
    }).join('/');
  };

  addApplies = function(druidQuery, applies) {
    var a, apply, applyIdx, countApply, sumApply, _i, _len;
    applies = applies.slice();
    druidQuery.aggregations = [];
    druidQuery.postAggregations = [];
    applyIdx = 0;
    while (applyIdx < applies.length) {
      apply = applies[applyIdx++];
      switch (apply.aggregate) {
        case 'count':
          druidQuery.aggregations.push({
            type: "count",
            name: apply.prop
          });
          break;
        case 'sum':
          druidQuery.aggregations.push({
            type: "doubleSum",
            name: apply.prop,
            fieldName: apply.attribute
          });
          break;
        case 'average':
          countApply = findCountApply(applies);
          if (!countApply) {
            applies.push(countApply = {
              operation: 'apply',
              aggregate: 'count',
              prop: '_count'
            });
          }
          sumApply = null;
          for (_i = 0, _len = applies.length; _i < _len; _i++) {
            a = applies[_i];
            if (a.aggregate === 'sum' && a.attribute === apply.attribute) {
              sumApply = a;
              break;
            }
          }
          if (!sumApply) {
            applies.push(sumApply = {
              operation: 'apply',
              aggregate: 'sum',
              prop: '_sum_' + apply.attribute,
              attribute: apply.attribute
            });
          }
          druidQuery.postAggregations.push({
            type: "arithmetic",
            name: apply.prop,
            fn: "/",
            fields: [
              {
                type: "fieldAccess",
                fieldName: sumApply.prop
              }, {
                type: "fieldAccess",
                fieldName: countApply.prop
              }
            ]
          });
          break;
        case 'min':
          druidQuery.aggregations.push({
            type: "min",
            name: apply.prop,
            fieldName: apply.attribute
          });
          break;
        case 'max':
          druidQuery.aggregations.push({
            type: "max",
            name: apply.prop,
            fieldName: apply.attribute
          });
          break;
        case 'unique':
          druidQuery.aggregations.push({
            type: "hyperUnique",
            name: apply.prop,
            fieldName: apply.attribute
          });
      }
    }
  };

  druidQuery = {
    all: function(_arg, callback) {
      var condensedQuery, dataSource, filters, interval, queryObj, requester;
      requester = _arg.requester, dataSource = _arg.dataSource, interval = _arg.interval, filters = _arg.filters, condensedQuery = _arg.condensedQuery;
      if ((interval != null ? interval.length : void 0) !== 2) {
        callback("Must have valid interval [start, end]");
        return;
      }
      if (condensedQuery.applies.length === 0) {
        callback(null, [
          {
            prop: {},
            _interval: interval,
            _filters: filters
          }
        ]);
        return;
      }
      queryObj = {
        dataSource: dataSource,
        intervals: [toDruidInterval(interval)],
        queryType: "timeseries",
        granularity: "all"
      };
      if (filters) {
        queryObj.filter = filters;
      }
      if (condensedQuery.applies.length > 0) {
        try {
          addApplies(queryObj, condensedQuery.applies);
        } catch (e) {
          callback(e);
          return;
        }
      }
      requester(queryObj, function(err, ds) {
        var splits;
        if (err) {
          callback(err);
          return;
        }
        if (ds.length !== 1) {
          callback("something went wrong");
          return;
        }
        splits = [
          {
            prop: ds[0].result,
            _interval: interval,
            _filters: filters
          }
        ];
        callback(null, splits);
      });
    },
    timeseries: function(_arg, callback) {
      var bucketDuration, combinePropName, condensedQuery, dataSource, filters, interval, queryObj, requester, timePropName, _ref, _ref1;
      requester = _arg.requester, dataSource = _arg.dataSource, interval = _arg.interval, filters = _arg.filters, condensedQuery = _arg.condensedQuery;
      if ((interval != null ? interval.length : void 0) !== 2) {
        callback("Must have valid interval [start, end]");
        return;
      }
      if (condensedQuery.applies.length === 0) {
        callback(null, [
          {
            prop: {},
            _interval: interval,
            _filters: filters
          }
        ]);
        return;
      }
      queryObj = {
        dataSource: dataSource,
        intervals: [toDruidInterval(interval)],
        queryType: "timeseries"
      };
      if (filters) {
        queryObj.filter = filters;
      }
      if (!((_ref = condensedQuery.combine) != null ? _ref.sort : void 0)) {
        callback("must have a sort combine for a split");
        return;
      }
      combinePropName = condensedQuery.combine.sort.prop;
      if (!combinePropName) {
        callback("must have a sort prop name");
        return;
      }
      timePropName = condensedQuery.split.prop;
      if (combinePropName !== timePropName) {
        callback("Must sort on the time prop for now (temp)");
        return;
      }
      bucketDuration = condensedQuery.split.duration;
      if (!bucketDuration) {
        callback("Must have duration for time bucket");
        return;
      }
      if ((_ref1 = !bucketDuration) === 'second' || _ref1 === 'minute' || _ref1 === 'hour' || _ref1 === 'day') {
        callback("Unsupported duration '" + bucketDuration + "' in time bucket");
        return;
      }
      queryObj.granularity = bucketDuration;
      if (condensedQuery.applies.length > 0) {
        try {
          addApplies(queryObj, condensedQuery.applies);
        } catch (e) {
          callback(e);
          return;
        }
      }
      requester(queryObj, function(err, ds) {
        var durationMap, limit, splits;
        if (err) {
          callback(err);
          return;
        }
        durationMap = {
          second: 1000,
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000
        };
        if (condensedQuery.combine.sort.direction === 'descending') {
          ds.reverse();
        }
        if (condensedQuery.combine.limit != null) {
          limit = condensedQuery.combine.limit;
          ds.splice(limit, ds.length - limit);
        }
        splits = ds.map(function(d) {
          var split, timestampEnd, timestampStart;
          timestampStart = new Date(d.timestamp);
          timestampEnd = new Date(timestampStart.valueOf() + durationMap[bucketDuration]);
          split = {
            prop: d.result,
            _interval: [timestampStart, timestampEnd],
            _filters: filters
          };
          split.prop[timePropName] = [timestampStart, timestampEnd];
          return split;
        });
        callback(null, splits);
      });
    },
    topN: function(_arg, callback) {
      var condensedQuery, dataSource, filters, interval, invertApply, queryObj, requester, sort, _ref;
      requester = _arg.requester, dataSource = _arg.dataSource, interval = _arg.interval, filters = _arg.filters, condensedQuery = _arg.condensedQuery;
      if ((interval != null ? interval.length : void 0) !== 2) {
        callback("Must have valid interval [start, end]");
        return;
      }
      if (condensedQuery.applies.length === 0) {
        callback(null, [
          {
            prop: {},
            _interval: interval,
            _filters: filters
          }
        ]);
        return;
      }
      queryObj = {
        dataSource: dataSource,
        intervals: [toDruidInterval(interval)],
        queryType: "topN",
        granularity: "all"
      };
      if (filters) {
        queryObj.filter = filters;
      }
      if (!condensedQuery.split.attribute) {
        callback("split must have an attribute");
        return;
      }
      if (!condensedQuery.split.prop) {
        callback("split must have a prop");
        return;
      }
      sort = condensedQuery.combine.sort;
      if ((_ref = sort.direction) !== 'ascending' && _ref !== 'descending') {
        callback("direction has to be 'ascending' or 'descending'");
        return;
      }
      if (sort.direction === 'descending') {
        invertApply = null;
      } else {
        invertApply = findApply(condensedQuery.applies, sort.prop);
        if (!invertApply) {
          callback("no apply to invert for bottomN");
          return;
        }
      }
      queryObj.dimension = {
        type: 'default',
        dimension: condensedQuery.split.attribute,
        outputName: condensedQuery.split.prop
      };
      queryObj.threshold = condensedQuery.combine.limit || 10;
      queryObj.metric = (invertApply ? '_inv_' : '') + condensedQuery.combine.sort.prop;
      if (condensedQuery.applies.length > 0) {
        try {
          addApplies(queryObj, condensedQuery.applies, invertApply);
        } catch (e) {
          callback(e);
          return;
        }
      }
      if (invertApply) {
        queryObj.postAggregations.push({
          type: "arithmetic",
          name: '_inv_' + invertApply.prop,
          fn: "*",
          fields: [
            {
              type: "fieldAccess",
              fieldName: invertApply.prop
            }, {
              type: "constant",
              value: -1
            }
          ]
        });
      }
      if (queryObj.postAggregations.length === 0) {
        delete queryObj.postAggregations;
      }
      requester(queryObj, function(err, ds) {
        var filterAttribute, filterValueProp, splits;
        if (err) {
          callback(err);
          return;
        }
        if (ds.length !== 1) {
          callback("something went wrong");
          return;
        }
        filterAttribute = condensedQuery.split.attribute;
        filterValueProp = condensedQuery.split.prop;
        splits = ds[0].result.map(function(prop) {
          return {
            prop: prop,
            _interval: interval,
            _filters: andFilters(filters, makeFilter(filterAttribute, prop[filterValueProp]))
          };
        });
        callback(null, splits);
      });
    },
    histogram: function(_arg, callback) {
      var condensedQuery, dataSource, filters, interval, requester;
      requester = _arg.requester, dataSource = _arg.dataSource, interval = _arg.interval, filters = _arg.filters, condensedQuery = _arg.condensedQuery;
      callback("not implemented yet");
    }
  };

  exports = function(_arg) {
    var aproximate, dataSource, filters, interval, requester, timeAttribute;
    requester = _arg.requester, dataSource = _arg.dataSource, timeAttribute = _arg.timeAttribute, aproximate = _arg.aproximate, interval = _arg.interval, filters = _arg.filters;
    timeAttribute || (timeAttribute = 'time');
    if (aproximate == null) {
      aproximate = true;
    }
    return function(query, callback) {
      var cmdIndex, condensedQuery, queryDruid, rootSegment, segments;
      condensedQuery = driverUtil.condenseQuery(query);
      rootSegment = null;
      segments = [rootSegment];
      queryDruid = function(condensedQuery, done) {
        var QUERY_LIMIT, combinePropName, queryFn, queryFns, queryForSegment, _ref;
        if (condensedQuery.split) {
          switch (condensedQuery.split.bucket) {
            case 'identity':
              if (!((_ref = condensedQuery.combine) != null ? _ref.sort : void 0)) {
                done("must have a sort combine for a split");
                return;
              }
              combinePropName = condensedQuery.combine.sort.prop;
              if (!combinePropName) {
                done("must have a sort prop name");
                return;
              }
              if (findApply(condensedQuery.applies, combinePropName) && aproximate) {
                queryFn = druidQuery.topN;
              } else {
                done('not implemented yet');
                return;
              }
              break;
            case 'time':
              queryFn = druidQuery.timeseries;
              break;
            case 'continuous':
              queryFn = druidQuery.histogram;
              break;
            default:
              done('unsupported query');
              return;
          }
        } else {
          queryFn = druidQuery.all;
        }
        queryForSegment = function(parentSegment, done) {
          queryFn({
            requester: requester,
            dataSource: dataSource,
            interval: parentSegment ? parentSegment._interval : interval,
            filters: parentSegment ? parentSegment._filters : filters,
            condensedQuery: condensedQuery
          }, function(err, splits) {
            if (err) {
              done(err);
              return;
            }
            if (parentSegment) {
              parentSegment.splits = splits;
              driverUtil.cleanSegment(parentSegment);
            } else {
              rootSegment = splits[0];
            }
            done(null, splits);
          });
        };
        QUERY_LIMIT = 10;
        queryFns = async.mapLimit(segments, QUERY_LIMIT, queryForSegment, function(err, results) {
          if (err) {
            done(err);
            return;
          }
          segments = driverUtil.flatten(results);
          done();
        });
      };
      cmdIndex = 0;
      async.whilst(function() {
        return cmdIndex < condensedQuery.length;
      }, function(done) {
        var condenced;
        condenced = condensedQuery[cmdIndex];
        cmdIndex++;
        queryDruid(condenced, done);
      }, function(err) {
        if (err) {
          callback(err);
          return;
        }
        segments.forEach(driverUtil.cleanSegment);
        callback(null, rootSegment);
      });
    };
  };

  if (typeof module === 'undefined') {
    window['druidDriver'] = exports;
  } else {
    module.exports = exports;
  }

}).call(this);

module Facet {
  export class ActionsExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): ActionsExpression {
      var value = UnaryExpression.jsToValue(parameters);
      value.actions = parameters.actions.map(Action.fromJS);
      return new ActionsExpression(value);
    }

    public actions: Action[];

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this.actions = parameters.actions;
      this._ensureOp("actions");
      this._checkTypeOfOperand('DATASET');
      this.type = 'DATASET';
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.actions = this.actions;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.actions = this.actions.map(action => action.toJS());
      return js;
    }

    public toString(): string {
      return this.operand.toString() + this.actions.map(action => action.toString()).join('\n  ');
    }

    public equals(other: ActionsExpression): boolean {
      return super.equals(other) && higherArraysEqual(this.actions, other.actions);
    }

    public expressionCount(): int {
      var expressionCount = super.expressionCount();
      var actions = this.actions;
      for (let action of actions) {
        expressionCount += action.expressionCount();
      }
      return expressionCount;
    }

    public getFn(): ComputeFn {
      var ex = this;
      var operand = this.operand;
      var actions = this.actions;
      return (d: Datum, def: boolean) => {
        if (d) {
          return ex.resolve(d).simplify().getFn()(null, def);
        }

        var dataset = operand.getFn()(null, def);

        for (let action of actions) {
          var actionExpression = action.expression;

          if (action instanceof FilterAction) {
            dataset = dataset.filter(action.expression.getFn());

          } else if (action instanceof ApplyAction) {
            dataset = dataset.apply(action.name, actionExpression.getFn());

          } else if (action instanceof DefAction) {
            dataset = dataset.def(action.name, actionExpression.getFn());

          } else if (action instanceof SortAction) {
            dataset = dataset.sort(actionExpression.getFn(), action.direction);

          } else if (action instanceof LimitAction) {
            dataset = dataset.limit(action.limit);

          }
        }

        return dataset;
      };
    }

    public getJSExpression(datumVar: string): string {
      throw new Error("can not call getJSExpression on actions");
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      throw new Error("can not call getSQL on actions");
    }

    public simplify(): Expression {
      if (this.simple) return this;

      var simpleOperand = this.operand.simplify();
      var simpleActions = this.actions.map(action => action.simplify()); //this._getSimpleActions();

      function isRemoteSimpleApply(action: Action): boolean {
        return action instanceof ApplyAction && action.expression.hasRemote() && action.expression.type !== 'DATASET';
      }

      // These are actions on a remote dataset
      var remoteDatasets = this.getRemoteDatasets();
      var remoteDataset: RemoteDataset;
      var digestedOperand = simpleOperand;
      if (remoteDatasets.length && (digestedOperand instanceof LiteralExpression || digestedOperand instanceof JoinExpression)) {
        remoteDataset = remoteDatasets[0];
        if (digestedOperand instanceof LiteralExpression && !digestedOperand.isRemote() && simpleActions.some(isRemoteSimpleApply)) {
          if (remoteDatasets.length === 1) {
            digestedOperand = new LiteralExpression({
              op: 'literal',
              value: remoteDataset.makeTotal()
            });
          } else {
            throw new Error('not done yet')
          }
        }

        var absorbedDefs: DefAction[] = [];
        var undigestedActions: Action[] = [];
        for (var i = 0; i < simpleActions.length; i++) {
          var action: Action = simpleActions[i];
          var digest = remoteDataset.digest(digestedOperand, action);
          if (digest) {
            digestedOperand = digest.expression;
            if (digest.undigested) undigestedActions.push(digest.undigested);
            if (action instanceof DefAction) absorbedDefs.push(action);
          } else {
            undigestedActions.push(action);
          }
        }
        if (simpleOperand !== digestedOperand) {
          simpleOperand = digestedOperand;
          var defsToAddBack: Action[] = absorbedDefs.filter(def => {
            return Action.actionsDependOn(undigestedActions, def.name);
          });
          simpleActions = defsToAddBack.concat(undigestedActions);
        }
      }

      if (simpleActions.length === 0) return simpleOperand;
      var simpleValue = this.valueOf();
      simpleValue.operand = simpleOperand;
      simpleValue.actions = simpleActions;
      simpleValue.simple = true;
      return new ActionsExpression(simpleValue);
    }

    protected _specialEvery(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean {
      var actions = this.actions;
      var every: boolean = true;
      for (let action of actions) {
        if (every) {
          every = action._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff + 1);
        } else {
          indexer.index += action.expressionCount();
        }
      }
      return every;
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Expression {
      var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
      if (sub) {
        indexer.index += this.expressionCount();
        return sub;
      } else {
        indexer.index++;
      }

      var subOperand = this.operand._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff);
      var subActions = this.actions.map(action => action._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff + 1));
      if (this.operand === subOperand && arraysEqual(this.actions, subActions)) return this;

      var value = this.valueOf();
      value.operand = subOperand;
      value.actions = subActions;
      delete value.simple;
      return new ActionsExpression(value);
    }

    public performAction(action: Action): Expression {
      return new ActionsExpression({
        op: 'actions',
        operand: this.operand,
        actions: this.actions.concat(action)
      });
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      indexer.index++;
      typeContext = this.operand._fillRefSubstitutions(typeContext, indexer, alterations);

      var actions = this.actions;
      for (let action of actions) {
        if (action instanceof DefAction || action instanceof ApplyAction) {
          typeContext.datasetType[action.name] = action.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        } else if (action instanceof SortAction || action instanceof FilterAction) {
          action.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        }
      }

      return typeContext;
    }

    public _computeResolved(): Q.Promise<NativeDataset> {
      var actions = this.actions;

      function execAction(i: int) {
        return (dataset: NativeDataset): NativeDataset | Q.Promise<NativeDataset> => {
          var action = actions[i];
          var actionExpression = action.expression;

          if (action instanceof FilterAction) {
            return dataset.filter(action.expression.getFn());

          } else if (action instanceof ApplyAction) {
            if (actionExpression instanceof ActionsExpression) {
              return dataset.applyPromise(action.name, (d: Datum) => {
                return actionExpression.resolve(d).simplify()._computeResolved();
              });
            } else {
              return dataset.apply(action.name, actionExpression.getFn());
            }

          } else if (action instanceof DefAction) {
            if (actionExpression instanceof ActionsExpression) {
              return dataset.def(action.name, (d: Datum) => {
                var simple = actionExpression.resolve(d).simplify();
                if (simple instanceof LiteralExpression) {
                  return simple.value;
                } else {
                  return simple._computeResolved();
                }
              });
            } else {
              return dataset.def(action.name, actionExpression.getFn());
            }

          } else if (action instanceof SortAction) {
            return dataset.sort(actionExpression.getFn(), action.direction);

          } else if (action instanceof LimitAction) {
            return dataset.limit(action.limit);

          }
        }
      }

      var promise = this.operand._computeResolved();
      for (var i = 0; i < actions.length; i++) {
        promise = promise.then(execAction(i));
      }
      return promise;
    }
  }

  Expression.register(ActionsExpression);
}

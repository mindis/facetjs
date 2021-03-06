module Facet {
  export class FilterAction extends Action {
    static fromJS(parameters: ActionJS): FilterAction {
      return new FilterAction({
        action: parameters.action,
        name: parameters.name,
        expression: Expression.fromJS(parameters.expression)
      });
    }

    constructor(parameters: ActionValue = {}) {
      super(parameters, dummyObject);
      this._ensureAction("filter");
      if (this.expression.type !== 'BOOLEAN') {
        throw new TypeError('must be a boolean expression')
      }
    }

    public toString(): string {
      return '.filter(' + this.expression.toString() + ')';
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      return `WHERE ${this.expression.toString()}`;
    }
  }
  Action.register(FilterAction);
}

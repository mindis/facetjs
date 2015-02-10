{ expect } = require("chai")
{ Set } = require('../../../build/facet').Core

tests = require './sharedTests'

describe 'OrExpression', ->
  describe 'with boolean expressions', ->
    beforeEach ->
      this.expression = { op: 'or', operands: [
        { op: 'literal', value: true },
        { op: 'literal', value: false },
        { op: 'literal', value: false }
      ] }

    tests.complexityIs(4)
    tests.simplifiedExpressionIs({op: 'literal', value: true})

  describe 'with is expressions', ->
    beforeEach ->
      this.expression = { op: 'or', operands: [
        { op: 'is', lhs: "$test", rhs: "blah" },
        { op: 'is', lhs: "$test", rhs: "test2" },
      ] }

    tests.complexityIs(7)
    tests.simplifiedExpressionIs({
      op: 'in',
      lhs: { op: 'ref', name: 'test' },
      rhs: {
        op: 'literal'
        value: { values: ["blah", "test2"]}
        type: 'SET'
      }
    })

  describe 'with is/in expressions', ->
    beforeEach ->
      this.expression = { op: 'or', operands: [
        { op: 'is', lhs: "$test", rhs: "blah3" },
        {
          op: 'in',
          lhs: "$test",
          rhs: {
            op: 'literal'
            value: Set.fromJS({ values: ["blah", "test2"]})
          }
        }
      ] }

    tests.complexityIs(7)
    tests.simplifiedExpressionIs({
      op: 'in',
      lhs: { op: 'ref', name: 'test' },
      rhs: {
        op: 'literal'
        value: { values: ["blah", "blah3", "test2"]}
        type: 'SET'
      }
    })

  describe 'with number comparison expressions', ->
    beforeEach ->
      this.expression = { op: 'or', operands: [
        { op: 'lessThan', lhs: "$test", rhs: 1 },
        { op: 'lessThanOrEqual', lhs: "$test", rhs: 0 }
      ] }

    tests.complexityIs(7)
    tests.simplifiedExpressionIs({ op: 'lessThan', lhs: { op: 'ref', name: "test" }, rhs: { op: 'literal', value: 1 }})

  describe 'with and expressions', ->
    beforeEach ->
      this.expression = { op: 'or', operands: [
        { op: 'or', operands: [{ op: 'lessThan', lhs: "$test1", rhs: 1 }, { op: 'lessThanOrEqual', lhs: "$test2", rhs: 0 }]}
        { op: 'or', operands: [{ op: 'lessThan', lhs: "$test3", rhs: 1 }, { op: 'lessThanOrEqual', lhs: "$test4", rhs: 0 }]}
      ] }

    tests.complexityIs(15)
    tests.simplifiedExpressionIs({ op: 'or', operands: [
      { op: 'lessThan', lhs: { op: 'ref', name: "test1" }, rhs: { op: 'literal', value: 1 }}
      { op: 'lessThanOrEqual', lhs: { op: 'ref', name: "test2" }, rhs: { op: 'literal', value: 0 }}
      { op: 'lessThan', lhs: { op: 'ref', name: "test3" }, rhs: { op: 'literal', value: 1 }}
      { op: 'lessThanOrEqual', lhs: { op: 'ref', name: "test4" }, rhs: { op: 'literal', value: 0 }}
    ] })
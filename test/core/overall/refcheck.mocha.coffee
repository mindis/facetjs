{ expect } = require("chai")

facet = require('../../../build/facet')
{ Expression } = facet.core

describe "reference check", ->

  typeContext = {
    diamonds: {
      time: 'TIME'
      color: 'STRING'
      cut: 'STRING'
      carat: 'NUMBER'
      price: 'NUMBER'
    }
  }

  describe "errors", ->
    it "fails to resolve a variable that does not exist", ->
      ex = facet()
        .def('num', 5)
        .apply('subData',
          facet()
            .apply('x', '$num + 1')
            .apply('y', '$foo * 2')
        )

      expect(->
        ex.referenceCheck({})
      ).to.throw('could not resolve $foo')

    it "fails to resolve a variable that does not exist (in scope)", ->
      ex = facet()
        .def('num', 5)
        .apply('subData',
          facet()
            .apply('x', '$num + 1')
            .apply('y', '$^x * 2')
        )

      expect(->
        ex.referenceCheck({})
      ).to.throw('could not resolve $^x')

    it "fails to when a variable goes too deep", ->
      ex = facet()
        .def('num', 5)
        .apply('subData',
          facet()
            .apply('x', '$num + 1')
            .apply('y', '$^^^x * 2')
        )

      expect(->
        ex.referenceCheck({x: 'NUMBER'})
      ).to.throw('went too deep on $^^^x')

    it "fails when discovering that the types mismatch", ->
      ex = facet()
        .def('str', 'Hello')
        .apply('subData',
          facet()
            .apply('x', '$str + 1')
        )

      expect(->
        ex.referenceCheck({})
      ).to.throw('add must have an operand of type NUMBER at position 0')

    it "fails when discovering that the types mismatch via label", ->
      ex = facet()
        .def("diamonds", facet("diamonds").filter(facet('color').is('D')))
        .apply('Cuts',
          facet("diamonds").group("$cut").label('Cut')
            .apply('TotalPrice', '$Cut * 10')
        )

      expect(->
        ex.referenceCheck(typeContext)
      ).to.throw('multiply must have an operand of type NUMBER at position 0')


  describe "resolves", ->
    it "works in a basic case", ->
      ex = facet()
        .def('num', 5)
        .apply('subData',
          facet()
            .apply('x', '$num + 1')
            .apply('y', '$x * 2')
        )

      expect(ex.referenceCheck({}).toJS()).to.deep.equal(
        facet()
          .def('num', 5)
          .apply('subData',
            facet()
              .apply('x', '$^num:NUMBER + 1')
              .apply('y', '$x:NUMBER * 2')
          )
          .toJS()
      )

    it "works from typeContext", ->
      ex = facet('diamonds')
        .def('priceOver2', '$price / 2')

      expect(ex.referenceCheck(typeContext).toJS()).to.deep.equal(
        facet('diamonds:DATASET')
          .def('priceOver2', '$price:NUMBER / 2')
          .toJS()
      )

    it "simulates a split", ->
      ex = facet()
        .def("diamonds", facet("diamonds").filter(facet('color').is('D')))
        .apply('Count', '$diamonds.count()')
        .apply('TotalPrice', '$diamonds.sum($price)')
        .apply('Cuts',
          facet("diamonds").group("$cut").label('Cut')
            .def('diamonds', facet('diamonds').filter(facet('cut').is('$^Cut')))
            .apply('Count', '$diamonds.count()')
            .apply('TotalPrice', '$diamonds.sum($price)')
            .apply('AvgPrice', '$TotalPrice / $Count')
            .sort('$AvgPrice', 'descending')
            .limit(10)
        )

      expect(ex.referenceCheck(typeContext).toJS()).to.deep.equal(
        facet()
          .def("diamonds", facet("^diamonds:DATASET").filter(facet('color:STRING').is('D')))
          .apply('Count', '$diamonds:DATASET.count()')
          .apply('TotalPrice', '$diamonds:DATASET.sum($price)')
          .apply('Cuts',
            facet("diamonds:DATASET").group("$cut").label('Cut')
              .def('diamonds', facet('^diamonds:DATASET').filter(facet('cut:STRING').is('$^Cut:STRING')))
              .apply('Count', '$diamonds:DATASET.count()')
              .apply('TotalPrice', '$diamonds:DATASET.sum($price)')
              .apply('AvgPrice', '$TotalPrice:NUMBER / $Count:NUMBER')
              .sort('$AvgPrice:NUMBER', 'descending')
              .limit(10)
          )
          .toJS()
      )

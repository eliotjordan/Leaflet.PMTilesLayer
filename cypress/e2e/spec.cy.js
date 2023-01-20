describe('Leaflet.PMTilesLayer', () => {
  describe('polygon tiles', () => {
    it('renders tiles', () => {
      cy.visit('cypress/pages/polygon.html')

      cy.get('.leaflet-tile-container')
        .find('svg')
        .should('have.length', 16)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 369)
    })

    it('renders tiles beyond the max zoom of the pmtiles dataset', () => {
      cy.visit('cypress/pages/polygon.html')

      cy.wait(1000)
      cy.get('.leaflet-control-zoom-in').click()

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 369)
    })


    it('renders tiles when initial zoom level beyond the max zoom of the pmtiles dataset', () => {
      cy.visit('cypress/pages/polygon-zoom.html')

      cy.wait(1000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 369)
    })
  })

  describe('point tiles', () => {
    it('renders tiles', () => {
      cy.visit('cypress/pages/point.html')

      cy.get('.leaflet-tile-container')
        .find('svg')
        .should('have.length', 16)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 186)
    })

    it('renders tiles when initial zoom level beyond the max zoom of the pmtiles dataset', () => {
      cy.visit('cypress/pages/point-zoom.html')

      cy.wait(1000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 2)
    })
  })

  describe('line tiles', () => {
    it('renders tiles', () => {
      cy.visit('cypress/pages/line.html')

      cy.get('.leaflet-tile-container')
        .find('svg')
        .should('have.length', 16)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 389)
    })

    it('renders tiles when initial zoom level beyond the max zoom of the pmtiles dataset', () => {
      cy.visit('cypress/pages/line-zoom.html')

      cy.wait(1000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 37)
    })
  })
  describe('use leaflet autoscaling', () => {
    it('autoscales after maxZoomNative is set', () => {
      cy.visit('cypress/pages/polygon-leaflet-autoscaling.html')

      cy.wait(1000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g')
        .should('have.length', 1)
    })
  })
  describe('disable autoscaling', () => {
    it('does not autoscale and returns blank tiles', () => {
      cy.visit('cypress/pages/polygon-no-autoscaling.html')

      cy.wait(1000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path')
        .should('have.length', 0)
    })
  })
})

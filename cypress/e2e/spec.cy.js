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

      cy.wait(4000)
      cy.get('.leaflet-control-zoom-in').click()

      cy.get('.leaflet-tile-container svg').first()
        .find('g path[d="M0 0"]')
        .should('have.length', 319)
    })


    it('renders tiles when initial zoom level beyond the max zoom of the pmtiles dataset', () => {
      cy.visit('cypress/pages/polygon-zoom.html')

      cy.wait(4000)

      cy.get('.leaflet-tile-container svg').first()
        .find('g path[d="M0 0"]')
        .should('have.length', 366)
    })
  })
})

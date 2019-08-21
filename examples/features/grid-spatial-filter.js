/* global FeatureGridWithSpatialFilter */
Ext.require([
    'Ext.container.Container',
    'Ext.panel.Panel',
    'Ext.grid.Panel',
    'Ext.grid.filters.Filters',
    'GeoExt.component.Map',
    'GeoExt.data.store.Features',
    'GeoExt.util.OGCFilter'
]);

var olMap;
var gridWest;
var featStore;
var wmsLayer;
var drawSelectPolygonInteraction;
var activeFilters = [];
var spatialOperators = Ext.create('Ext.data.Store', {
    fields: ['abbreviation', 'name'],
    data: [{
        abbreviation: 'intersect',
        name: 'Intersects'
    }, {
        abbreviation: 'within',
        name: 'Within'
    }, {
        abbreviation: 'equals',
        name: 'Equals'
    }, {
        abbreviation: 'contains',
        name: 'Contains'
    }, {
        abbreviation: 'disjoint',
        name: 'Disjoint'
    }, {
        abbreviation: 'touches',
        name: 'Touches'
    }, {
        abbreviation: 'crosses',
        name: 'Crosses'
    }, {
        abbreviation: 'overlaps',
        name: 'Overlaps'
    }, {
        abbreviation: 'bbox',
        name: 'BBOX'
    }]
});

Ext.application({
    name: 'FeatureGridWithSpatialFilter',
    launch: function() {
        // also add an WMS layer to show the support
        // via `filter` request parameter
        wmsLayer = new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: 'https://maps.dwd.de/geoserver/dwd/ows?',
                params: {
                    'LAYERS': 'dwd:Warngebiete_Kreise',
                    'TILED': true
                },
                attributions: [new ol.Attribution({
                    html: '<a href="https://www.dwd.de">' +
                      'Copyright: © Deutscher Wetterdienst</a>'
                })]
            })
        });

        olMap = new ol.Map({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.TileWMS({
                        url: 'https://ows.terrestris.de/osm-gray/service',
                        params: {'LAYERS': 'OSM-WMS', 'TILED': true},
                        attributions: [new ol.Attribution({
                            html: '<a href="https://www.openstreetmap.org/' +
                            'copyright">OpenStreetMap contributors</a>'
                        })]
                    })
                }),
                wmsLayer
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([10, 51]),
                zoom: 6
            })
        });

        // create and prepare draw interaction
        drawSelectPolygonInteraction = new ol.interaction.Draw({
            type: 'Polygon'
        });
        drawSelectPolygonInteraction.setActive(false);
        drawSelectPolygonInteraction.on('drawend', this.onDrawEnd, this);
        olMap.addInteraction(drawSelectPolygonInteraction);

        // create feature store by passing a layer
        featStore = Ext.create('GeoExt.data.store.WfsFeatures', {
            model: 'GeoExt.data.model.Feature',
            passThroughFilter: true,
            createLayer: true,
            remoteSort: false,
            pageSize: 0,
            requestMethod: 'POST',
            layerAttribution: '| <a href="https://www.dwd.de/"> ' +
                'Source: Deutscher Wetterdienst</a>',
            url: 'https://maps.dwd.de/geoserver/dwd/ows?',
            version: '1.1.0',
            typeName: 'dwd:Warngebiete_Kreise',
            outputFormat: 'application/json',
            format: new ol.format.GeoJSON({
                featureProjection: 'EPSG:3857'
            }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(255, 255, 0, 1.0)',
                    width: 2
                })
            })
        });

        // create the feature grid
        gridWest = Ext.create('Ext.grid.Panel', {
            title: 'Feature Grid with spatial selection',
            border: true,
            region: 'west',
            store: featStore,
            plugins: 'gridfilters',
            tools: [{
                xtype: 'combobox',
                name: 'spatialOperatorsCombo',
                store: spatialOperators,
                queryMode: 'local',
                displayField: 'name',
                valueField: 'abbreviation',
                value: 'intersect',
                margin: '0 5 0 0',
                onChange: function(val) {
                    FeatureGridWithSpatialFilter.app.
                        createDrawInteraction(val, true);
                }
            }, {
                xtype: 'button',
                text: 'Draw',
                tooltip: 'Draw geometry used to define the spatial filter',
                enableToggle: true,
                menu: [{
                    text: 'Point',
                    handler: function() {
                        FeatureGridWithSpatialFilter.app.
                            createDrawInteraction('Point');
                    }
                }, {
                    text: 'LineString',
                    handler: function() {
                        FeatureGridWithSpatialFilter.app.
                            createDrawInteraction('LineString');
                    }
                }, {
                    text: 'Polygon',
                    handler: function() {
                        FeatureGridWithSpatialFilter.app.
                            createDrawInteraction('Polygon');
                    }
                }],
                margin: '0 5 0 0'
            }, {
                xtype: 'button',
                glyph: 'f00d@FontAwesome',
                onClick: function() {
                    activeFilters = [];
                    this.up('grid').getStore().clearFilter();
                    FeatureGridWithSpatialFilter.app.refreshFilters();
                }
            }],
            columns: [{
                text: 'List',
                dataIndex: 'WARNCELLID',
                flex: 1,
                filter: {
                    type: 'list'
                }
            }, {
                text: 'String',
                dataIndex: 'NAME',
                flex: 2,
                filter: {
                    type: 'string'
                }
            }, {
                text: 'Number',
                dataIndex: 'WARNCELLID',
                flex: 2,
                filter: {
                    type: 'number'
                }
            }, {
                text: 'Date',
                xtype: 'datecolumn',
                formatter: 'date("Y-m-d")',
                dataIndex: 'PROCESSTIME',
                flex: 2,
                filter: {
                    type: 'date',
                    dateFormat: 'Y-m-d'
                }
            }],
            width: 600,
            listeners: {
                'filterchange': function(rec, filters) {
                    activeFilters = filters;
                    FeatureGridWithSpatialFilter.app.refreshFilters();
                }
            }
        });
        var mapComponent = Ext.create('GeoExt.component.Map', {
            map: olMap
        });
        var mapPanel = Ext.create('Ext.panel.Panel', {
            region: 'center',
            height: 400,
            layout: 'fit',
            items: [mapComponent]
        });
        var description = Ext.create('Ext.panel.Panel', {
            contentEl: 'description',
            region: 'north',
            title: 'Description',
            height: 230,
            border: false,
            bodyPadding: 5,
            autoScroll: true
        });
        Ext.create('Ext.Viewport', {
            layout: 'border',
            items: [description, mapPanel, gridWest]
        });
    },

    /**
     *
     */
    refreshFilters: function() {
        var wmsFilter = GeoExt.util.OGCFilter.
            getOgcWmsFilterFromExtJsFilter(activeFilters);
        wmsLayer.getSource().updateParams({
            filter: wmsFilter,
            cacheBuster: Math.random()
        });
    },

    onDrawEnd: function(evt) {
        var feature = evt.feature;
        var geometry = feature.getGeometry();
        var typeName = 'THE_GEOM';
        var spatialOperatorsCombo = Ext.ComponentQuery.
            query('combobox[name="spatialOperatorsCombo"]')[0];
        var operator = spatialOperatorsCombo.getValue();

        // construct an instance of Filter
        var extFilter = new Ext.util.Filter({
            type: 'spatial',
            srsName: olMap.getView().getProjection().getCode(),
            operator: operator,
            property: typeName,
            value: geometry
        });

        featStore.addFilter(extFilter);
        this.refreshFilters();
    },

    createDrawInteraction: function(val, check) {
        if (check) {
            val = 'Polygon';
            Ext.toast('Polygon is used in draw interaction');
        }
        olMap.removeInteraction(drawSelectPolygonInteraction);
        drawSelectPolygonInteraction = new ol.interaction.Draw({
            type: val !== 'bbox' ? val : 'Circle',
            geometryFunction: val === 'bbox' ?
                ol.interaction.Draw.createBox() :
                undefined
        });
        drawSelectPolygonInteraction.on('drawend',
            FeatureGridWithSpatialFilter.app.onDrawEnd,
            FeatureGridWithSpatialFilter.app
        );
        olMap.addInteraction(drawSelectPolygonInteraction);
    }
});

//declare map and data statistics variable globally so all functions have access
var map;
var dataStats = {};

//function for the pop up content in retrieve so it can dynamically change as we sequence through time
function PopupContent(properties, attribute) {
	this.properties = properties;
	this.attribute = attribute;
	this.year = attribute.split("_")[1];
	this.population = this.properties[attribute];
	this.formatted = "<p><b>Country:</b> " + this.properties["Country or Area"] + "</p><p><b>Nuclear Electricity Output in " + this.year + ":</b> " + this.population + " million kilowatts per hour</p>";
};


function createMap(){

    //create the map
    map = L.map('map', {
        center: [0, 0],
        zoom: 2 
    });

    //the basemap
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
    }).addTo(map);
    //call getData function
    getData();
};

//calculating statistics needed for future functions
function calcStats(data){
    //create empty array to store all data values
    var allValues = [];
    //loop through each city
    for(var city of data.features){
        //loop through each year
        for(var year = 2000; year <= 2011; year+=10){
              //get population for current year
              var value = city.properties["yr_"+ String(year)];
              //add value to array
              allValues.push(value);
        }
    }
    //get min, max, mean stats for our array
    dataStats.min = Math.min(...allValues);
    dataStats.max = Math.max(...allValues);
    //calculate meanValue
    var sum = allValues.reduce(function(a, b){return a+b;});
    dataStats.mean = sum/ allValues.length;
    dataStats.max = 800000; //setting the max to around the actual max for the sake of the legend
    dataStats.mean =300000; //setting the "mean" to about half of the max for the sake of the legend
}

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 0.3; 
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(attValue/dataStats.min,0.5715) * minRadius

    return radius;
};

//function to convert markers to circle markers and add popups
function pointToLayer(feature, latlng, attributes){
    //Determine which attribute to visualize with proportional symbols
    //Assign the current attribute based on the first index of the attributes array

    var attribute = attributes[0];

    //create marker options
    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    //setting a minimum symbol radius because with the actual min radius for flannery, it is too small for the map
    if (options.radius > 4.21) {
        var radius = calcPropRadius(feature.properties[attribute]);
        layer.setRadius(radius);
    }

    else {
        layer.setRadius(4.21);
    }

	//create popup content - object version	  
	var popupContent = new PopupContent(feature.properties, attribute);
	layer.bindPopup(popupContent.formatted, { offset: new L.Point(0, -options.radius) });

    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};

//Example 2.1 line 34...Add circle markers for point features to the map
function createPropSymbols(data, attributes){
    //create a Leaflet GeoJSON layer and add it to the map
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute){
    var year = attribute.split("_")[1];
	//update temporal legend
	document.querySelector("span.year").innerHTML = year;
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            
            layer.setRadius(radius);

            //setting a minimum symbol radius because with the actual min radius for flannery, it is too small for the map
            if (radius > 4.21) {
                var radius = calcPropRadius(props[attribute]);
                layer.setRadius(radius);
            }

            else {
                layer.setRadius(4.21);
            }

            //using the popupcontent function from earlier to dynamically change it
            var popupContent = new PopupContent(props, attribute);
			popup = layer.getPopup();
			popup.setContent(popupContent.formatted).update();

        };
    });
};

//function to process the data and get an attributes array
function processData(data){
    //empty array to hold attributes
    var attributes = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;
    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take attributes with population values
        if (attribute.indexOf("yr_") > -1){
            attributes.push(attribute);
        };
    };

    return attributes;
};

//function to create new sequence controls
function createSequenceControls(attributes) {

	//define sequence control
	var SequenceControl = L.Control.extend({
		options: {
			position: 'bottomleft'
		},

		onAdd: function () {
			// create the control container div with a particular class name
			var container = L.DomUtil.create('div', 'sequence-control-container');

			//create range input element (slider)
			container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">')

			//add skip buttons
			container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="Reverse"><img src="img/reverse.png"></button>');
			container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="Forward"><img src="img/forward.png"></button>');

			//disable any mouse event listeners for the container
			L.DomEvent.disableClickPropagation(container);

			return container;
		}
	});

	//add sequence control
	map.addControl(new SequenceControl());

	//set slider attributes
	document.querySelector(".range-slider").max = 10;
	document.querySelector(".range-slider").min = 0;
	document.querySelector(".range-slider").value = 0;
	document.querySelector(".range-slider").step = 1;

	//input listener for slider
	document.querySelector('.range-slider').addEventListener('input', function () {
		//get the new index value
		var index = this.value;

		//pass new attribute to update symbols
		updatePropSymbols(attributes[index]);
	});

	//click listener for buttons
	document.querySelectorAll('.step').forEach(function (step) {
		step.addEventListener("click", function () {
			var index = document.querySelector('.range-slider').value;

			//increment or decrement depending on button clicked
			if (step.id == 'forward') {
				index++;
				//if past the last attribute, wrap around to first attribute
				index = index > 10 ? 0 : index;
			} else if (step.id == 'reverse') {
				index--;
				//if past the first attribute, wrap around to last attribute
				index = index < 0 ? 10 : index;
			};

			//update slider
			document.querySelector('.range-slider').value = index;

			//pass new attribute to update symbols
			updatePropSymbols(attributes[index]);
		})
	})
};

//function to create the legend
function createLegend(attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');

            container.innerHTML = '<p class="temporalLegend">Nuclear Energy Output in <span class="year">2000</span> (million kilowatts per hour)</p>';

            //start attribute legend svg string
            var svg = '<svg id="attribute-legend" width="130px" height="60px">';
            //array of circle names to base loop on
			var circles = ["max", "mean", "min"];

			//loop to add each circle and text to svg string  
			for (var i = 0; i < circles.length; i++) {
                
				//assign the r and cy attributes  
				var radius = calcPropRadius(dataStats[circles[i]]);
				
                //need an if else since we cannot change the min variable from dataStats function, but need the smallest symbil size to be bigger
                //if is for the smallest symbol size
                if (circles[i]=="min"){
                    radius = 4.21;
                    var cy = 50 - radius;

                    //circle string  
                    svg += '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + '"cy="' + cy + '" fill="#F47821" fill-opacity="0.8" stroke="#000000" cx="30"/>';

                    //create legend text to label each circle     				          
                    var textY = i * 20 + 12;
                    svg += '<text id="' + circles[i] + '-text" x="70" y="' + textY + '">< 40000</text>';
			    

                }
                //else is for the max and "mean" symbols
                else{
                    var cy = 50 - radius;

                    //circle string  
                    svg += '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + '"cy="' + cy + '" fill="#F47821" fill-opacity="0.8" stroke="#000000" cx="30"/>';

                    //create legend text to label each circle     				          
                    var textY = i * 20 + 12;
                    svg += '<text id="' + circles[i] + '-text" x="70" y="' + textY + '">' + Math.round(dataStats[circles[i]] * 100) / 100  + '</text>';
			    }
            };

			//close svg string
			svg += "</svg>";

            //add attribute legend svg to container
            container.innerHTML += svg;

            return container;
        }
    });

    map.addControl(new LegendControl());

};

//function to run all of the previous functions have a working interactive map!
function getData(map){
    //load the data
    fetch("data/UN_NuclearElecData.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            var attributes = processData(json);
            calcStats(json);
            //call function to create proportional symbols, sequnce controls, and legend
            createPropSymbols(json, attributes);
            createSequenceControls(attributes);
            createLegend(attributes);
        })
};

document.addEventListener('DOMContentLoaded',createMap)
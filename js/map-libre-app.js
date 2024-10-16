(function () {
  // get page elements
  const modal = document.querySelector("#modal");
  const button = document.querySelector("#button");
  const h1 = document.querySelector("h1");
  const h3 = document.querySelector("h3");
  const statsWindow = document.querySelector("#stats");
  const statsButton = document.querySelector("#stats-button");

  let chartDrawn = false;

  statsButton.addEventListener("click", function () {
    if (
      statsWindow.style.display === "none" ||
      statsWindow.style.display === ""
    ) {
      statsWindow.style.display = "block";
    } else {
      statsWindow.style.display = "none";
    }
  });

  document.addEventListener("click", function (e) {
    if (
      statsWindow.style.display === "block" &&
      !statsWindow.contains(e.target) &&
      !statsButton.contains(e.target)
    ) {
      statsWindow.style.display = "none";
    }
  });

  // display modal when button is clicked
  button.addEventListener("click", function () {
    modal.style.display = "block";
  });

  // close modal when user clicks anywhere on the page
  modal.addEventListener("click", function () {
    modal.style.display = "none";
  });

  // Set button UI
  buttonUI();

  function buttonUI() {
    button.style.top = h1.offsetHeight + 20 + "px";
  }

  // Add event listener for window resize
  // When page rotates or is resized, reset page UI
  window.addEventListener("resize", buttonUI);

  const map = new maplibregl.Map({
    container: "map", // container id
    // emoji: dynamite!
    // this is the style that you'll want to replace with your own
    style:
      "https://api.maptiler.com/maps/0196b0e2-ea56-44ac-bf94-c9fb230df9ad/style.json?key=VR7FKTd6lXA4PKRQVzfY", // style URL
    center: [-84.475, 38.02], // starting position [lng, lat]
    zoom: 10.2, // starting zoom
  });

  // Add zoom and rotation controls to the map.
  map.addControl(new maplibregl.NavigationControl());

  // Load data from remote source using D3 and async/await
  async function fetchData() {
    const data = await d3.csv("data/Fayette_2023Crashes_KABCO.csv");
    const sidecar = await d3.csv("data/factors.csv");
    console.log(data, sidecar);
    createGeoJson(data, sidecar);
  }

  fetchData(); // invokes the fetchData function
  // console.log(data);

  // function to convert text to title case, source: https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
  function toTitleCase(str) {
    return str.replace(
      /\w\S*/g,
      (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
  }

  function getTimeGroup(data) {
    const timeGroup = parseInt(data.CollisionTime);

    if (timeGroup >= 0 && timeGroup <= 299) {
      return "0000 - 0299";
    } else if (timeGroup >= 300 && timeGroup <= 599) {
      return "0300 - 0599";
    } else if (timeGroup >= 600 && timeGroup <= 899) {
      return "0600 - 0899";
    } else if (timeGroup >= 900 && timeGroup <= 1199) {
      return "0900 - 1199";
    } else if (timeGroup >= 1200 && timeGroup <= 1499) {
      return "1200 - 1499";
    } else if (timeGroup >= 1500 && timeGroup <= 1799) {
      return "1500 - 1799";
    } else if (timeGroup >= 1800 && timeGroup <= 2099) {
      return "1800 - 2099";
    } else if (timeGroup >= 2100 && timeGroup <= 2399) {
      return "2100 - 2399";
    }

    return "ALL"; // Default for showing all crashes if no time matches

    filterBy();
  }

  function createGeoJson(data, sidecar) {
    const geojson = {
      type: "FeatureCollection",
      // map method returns a new array from the data array
      features: data.map(function (d) {
        const feature = {
          type: "Feature",
          properties: {
            KABCO: d.KABCO,
            STATS: `Injuries: ${d.NumberInjured} | Fatalities: ${d.NumberKilled}`,
            ID: d.IncidentID,
            Time: d.CollisionTime,
            TimeGroup: getTimeGroup(d.CollisionTime),
            MannerofCollision: d.MannerofCollision,
            xtra: "",
          },
          geometry: {
            type: "Point",
            coordinates: [+d.Longitude, +d.Latitude],
          },
        };
        // let's see if the sidecar files have a join and dump it into the properties
        let factors = {};
        // loop through the sidecar data
        sidecar.forEach(function (s) {
          if (s.IncidentId == d.IncidentID) {
            // decide which fields to use, sum, or count
            if (s.Factor_Type) {
              factors[s.Factor_Type] == 1
                ? factors[s.Factor_Type]++
                : (factors[s.Factor_Type] = 1);
            }
            if (s.Factor_Text) {
              factors[s.Factor_Text] = true;
            }
          }
        });
        // add the factors to the properties as string for the popup
        for (const f in factors) {
          feature.properties.xtra += `<li>${f}: ${factors[f]}</li>`;
        }
        // return the feature to the features array
        return feature;
      }),
    };

    // check the geojson
    console.log(geojson);

    // need to add the ability to define KABCO colors
    // access KABCO values in the data array
    const KABCO = data.map((d) => d.KABCO);
    // console.log(KABCO); // This will log an array of KABCO values

    // add breakdown for colorizing KABCO values
    // id will be used to match the value in KABCO with the id property in the kabcoVals object
    // Add prop for checked to determine if the KABCO value is visible
    const kabcoVals = [
      {
        id: "1",
        text: "Fatal Crash",
        color: "#FF0000",
        size: "10",
        checked: true,
      },
      {
        id: "2",
        text: "Serious Injury Crash",
        color: "#ff7b00",
        size: "8",
        checked: true,
      },
      {
        id: "3",
        text: "Minor Injury Crash",
        color: "#f5ee22",
        size: "6",
        checked: true,
      },
      {
        id: "4",
        text: "Possible Injury Crash",
        color: "#05fa3a",
        size: "4",
        checked: true,
      },
      {
        id: "5",
        text: "Property Damage Only",
        color: "#1953ff",
        size: "2.5",
        checked: true,
      },
    ];

    // Build the legend from CSS and the kabcoVals array
    const legend = document.getElementById("legend");
    kabcoVals.forEach(function (item) {
      const div = document.createElement("div");
      // Style each with a checkbox, color, and text. Note the value is the KABCO value
      div.innerHTML = `
       <input type="checkbox" value="${item.id}" checked>
                <span class="legend-boxes" style="background-color: ${item.color}"></span>
                <label for="${item.id}">${item.text}</label>`;
      legend.appendChild(div);
    });
    // Add event listener to the legend checkboxes. Returns an array of checkboxes
    const legendBoxes = document.querySelectorAll("#legend input");
    // Loop through the checkboxes and add an event listener to each
    legendBoxes.forEach(function (input) {
      // When the checkbox is changed, update the map
      input.addEventListener("change", function (e) {
        // Loop through the kabcoVals array and update the checked property
        kabcoVals.forEach(function (item) {
          if (e.target.value == item.id) {
            item.checked = e.target.checked;
          }
        });
        // Create an array to hold the KABCO values
        let categories = [];
        // Loop through the kabcoVals array and push the id to the categories array if checked
        kabcoVals.forEach(function (item) {
          if (item.checked) {
            categories.push(item.id);
          }
        });
        // Use the filter expression and setFilter method to filter the data
        const filter = [
          "in", // Filter the data to only include the KABCO values in the array
          ["get", "KABCO"], // The attribute field to filter on
          ["literal", categories],
        ];
        map.setFilter("crashes", filter);
        map.setFilter("heatLayer", filter);
      });
    });

    // Add the data to the map after loading
    map.on("load", function () {
      // add source first
      map.addSource("crashes", {
        type: "geojson",
        data: geojson,
      });
      // add layer
      map.addLayer({
        id: "crashes",
        type: "circle",
        source: "crashes",
        filter: [
          "in", // Filter the data to only include the KABCO values in the array
          ["get", "KABCO"], // The attribute field to filter on
          ["literal", ["1", "2", "3", "4", "5"]], // The values to include
        ],
        paint: {
          "circle-radius": 5,
          // color circles by KABCO values
          // style expressions, check maplibre documentation: https://maplibre.org/maplibre-style-spec/expressions/
          "circle-color": createFillColor(kabcoVals),
          "circle-opacity": 0.75,
          "circle-stroke-width": 0.75,
          "circle-stroke-color": "#222",
        },
      });

      // add heat layer using mapLibre (Documentation: https://maplibre.org/maplibre-gl-js/docs/examples/heatmap-layer/)
      map.addLayer({
        // mapLibre to add layers
        id: "heatLayer", // what is this layer called?
        type: "heatmap", // what type of layer is being added to the map from MapLibre?
        source: "crashes", // what is the source data for this layer?
        paint: {
          // paint{} controls the colors
          // color ramp for heatmap
          // begin color ramp at 0-stop with a 0-transparency color
          // to create blur-like effect
          // these were styles used in the sample, slightly tweaked
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.3,
            "rgba(103,169,207,0.75)",
            0.5,
            "rgba(209,229,240,0.9)",
            0.75,
            "rgb(253,219,199)",
            0.9,
            "rgb(239,138,98)",
            1,
            "rgb(178,24,43)",
          ],
          // Adjust the heatmap radius by zoom level
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            10,
            15,
            20,
          ],
          // Transition from heatmap to circle layer by zoom level
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, // the most zoomed out zoom level will have...
            0.75, // ...a 75% opacity on the heat layer (25% transparency), which will smoothly transition to...
            14, // ...zoom level 14, which will have an opacity of....
            0, // 0%, or 100% transparent
          ],
        },
      });

      // Add a popup to the map
      map.on("click", "crashes", function (e) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const d = e.features[0].properties;
        let description = `<strong>KABCO:</strong> ${d.KABCO}<br>${d.STATS
          }<br>ID: ${d.ID}<br>Collision Time: ${d.Time
          }<br>Manner of Collision: ${toTitleCase(d.MannerofCollision)}`;
        if (d.xtra) {
          description += `<br><strong>Factors:</strong><ul>${d.xtra}</ul>`;
        }
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(map);
      });

      map.on("mouseenter", "crashes", function () {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "crashes", function () {
        map.getCanvas().style.cursor = "";
      });


      filterBy(); // not passing any data?

      function filterBy(data) {
        const filters = ['==', 'TimeGroup', data.TimeGroup];
        map.setFilter('crashes', filters);
        map.setFilter('heatLayer', filters);

        // set the label to the time group
        document.getElementById('Time Group').textContent = timeGroup[data.TimeGroup];
      }

      document.getElementById('slider-controls').addEventListener('input', (e) => {
        const time = parseInt(e.target.value, 10);
        filterBy(time);
      });
    }); // end map.on function to add crashes

    // using the array of KABCO and kabcoVals, create a createFillColor function to determine color to paint the crashes
    function createFillColor(kabcoVals) {
      const colors = kabcoVals.reduce((agg, item) => {
        // console.log(agg);
        agg.push(item.id);
        agg.push(item.color);
        return agg;
      }, []);
      console.log(
        `["match", ["literal", ["get", 'KABCO']], ${colors}, "#CCC"]`
      );
      // Style expressions are tricky. They use strings and arrays to create a style.
      // This is a match expression that uses KABCO value to determine the color of the circle.
      // KABCO is not a variable in this case.
      return ["match", ["get", "KABCO"], ...colors, "#CCC"];
    }

    crashStats(data);
  } // end createGeoJson

  // Function to calculate crash statistics
  function crashStats(data) {
    const stats = {
      KABCO: {},
      MannerofCollision: {},
      NumberKilled: 0,
      NumberInjured: 0,
    };
    data.forEach(function (d) {
      if (d.KABCO in stats.KABCO) {
        stats.KABCO[d.KABCO]++;
      } else {
        stats.KABCO[d.KABCO] = 1;
      }
      // Handle Manner of Collision, including invalid or missing data
      let collisionType =
        d.MannerofCollision && d.MannerofCollision.trim() !== ""
          ? d.MannerofCollision
          : "UNKNOWN"; // Assign "Unknown" if data is missing or invalid
      if (collisionType in stats.MannerofCollision) {
        stats.MannerofCollision[collisionType]++;
      } else {
        stats.MannerofCollision[collisionType] = 1;
      }
      if (+d.NumberKilled) {
        stats.NumberKilled += +d.NumberKilled;
      }
      if (+d.NumberInjured) {
        stats.NumberInjured += +d.NumberInjured;
      }
    });

    console.log(stats);

    // Take manner of collision data and add it to the crash statistics div
    // manner of collision in the stats function is an array of arrays, which is hard to parse out
    // need to separate the inner from the outer arrays
    let mannerOfColStats = "";

    const mannerSorted = {};
    for (const [type, count] of Object.entries(stats.MannerofCollision).sort(
      (a, b) => b[1] - a[1]
    )) {
      mannerOfColStats += `<strong>${type}</strong>: ${count.toLocaleString()}<br>`; // takes the collision type (angle, single vehicle, etc) and the count for each to a string
      mannerSorted[type] = count;
      // console.log(mannerSorted);
    }

    // define the data into HTML which we will place inside a defined div element
    const crashData = `
        <strong>Number Killed</strong>: ${stats.NumberKilled}<br>
        <strong>Number Injured</strong>: ${stats.NumberInjured.toLocaleString()}<br><br>
        <strong>Manner of Collision</strong>:<br>
    <ul>${mannerOfColStats}</ul>
    `;
    // what is inside the stats div is now going to be equal to what we defined in crashData, taken from the crashStats fx
    // stats is defined in the CSS
    document.querySelector("#stats .container").innerHTML = crashData;
    // Need an array of the manner of collision data
    d3Sorted = Object.entries(stats.MannerofCollision).sort((a, b) => b[1] - a[1]);
    drawChart(stats, d3Sorted);
  } // end crashStats

  // function to draw chart
  // This needs some more noodling to get the chart to display correctly
  function drawChart(stats, mannerSorted) {
    console.log(mannerSorted)
    // select the HTML element that will hold our chart
    const barChart = d3.select("#bar-chart");

    // determine the width and height of chart from container
    // const width = barChart.offsetWidth - 40;
    const width = 380;

    // append a new SVG element to the container
    const svg = barChart
      .append("svg")
      .attr("width", width)
      .attr("height", 380)

    // x scale determines how wide each bar will be
    const x = d3
      .scaleLinear()
      .range([0, width])
      .domain([0, d3.max(mannerSorted, (d) => d[1])]);

    // y scale determines how tall each bar will be
    const y = d3
      .scaleBand()
      .range([380, 0])
      .domain(mannerSorted.map((d) => d[0]));

    color = d3
      .scaleOrdinal(d3.schemeTableau10)
      .domain(mannerSorted.map((d) => d[0]));

    // append a new SVG group to the SVG element
    svg
      .append("g")
      .selectAll("rect")
      .data(mannerSorted)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", (d) => y(d[0]))
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 100) // (d) => x(d[1])
      .attr("fill", (d) => color(d[0]));
  }
})();

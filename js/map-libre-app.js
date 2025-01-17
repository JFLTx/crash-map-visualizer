(function () {
  // get page elements
  const modal = document.querySelector("#modal");
  const button = document.querySelector("#button");
  const h1 = document.querySelector("h1");
  const h3 = document.querySelector("h3");
  const statsWindow = document.querySelector("#stats");
  const statsButton = document.querySelector("#stats-button");
  const spinner = document.querySelector(".spinner-container");

  // Function to show the spinner
  function showSpinner() {
    spinner.style.display = "flex"; // Show the spinner
  }

  // Function to hide the spinner
  function hideSpinner() {
    spinner.style.display = "none"; // Hide the spinner
  }

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

  // Load data from remote source using D3 and async/await
  async function fetchData() {
    // show the spinner while the data loads
    showSpinner();
    const csv = await d3.csv("data/Fayette_2023Crashes_KABCO.csv");
    const sidecar = await d3.csv("data/factors.csv");
    const counties = await d3.json("data/Ky_County_Polygons.geojson");
    const tracts = await d3.json("data/DOT_Disadv_CensusTract_Fayette.geojson");

    const data = csv.filter(
      (row) => !row.DirAnalysisCode.includes("PARKING LOT")
    );

    // Update MannerofCollision to 'UNKNOWN' if it is null or blank
    data.forEach((row) => {
      if (!row.MannerofCollision || row.MannerofCollision.trim() === "") {
        row.MannerofCollision = "UNKNOWN";
      }
    });

    // Filter counties to only include the Fayette County
    const fayette = {
      type: "FeatureCollection",
      features: counties.features.filter(
        (feature) => feature.properties.NAME === "FAYETTE"
      ),
    };
    // console.log(data, sidecar, counties);
    // console.log(fayette);
    console.log(tracts);
    createGeoJson(data, sidecar, fayette, tracts);

    // hide the spinner when the data finally loads!
    hideSpinner();
  }

  // have a filter variable defined and be editable
  let filter = null;

  // Create global div for the tooltip and hide with opacity
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("background-color", "#FFFAF0")
    .style("stroke", "black")
    .style("stroke-width", "1px")
    .style("padding", "10px")
    .style("border-radius", "5px")
    .style("z-index", 5000);

  // Add event listener for window resize
  // When page rotates or is resized, reset page UI
  window.addEventListener("resize", buttonUI);

  const map = new maplibregl.Map({
    container: "map", // container id
    // emoji: dynamite!
    // this is the style that you'll want to replace with your own
    style:
      "https://api.maptiler.com/maps/933ba1d3-2d03-46b6-8ed9-9eb848c5b585/style.json?key=VR7FKTd6lXA4PKRQVzfY", // style URL
    center: [-84.475, 38.02], // starting position [lng, lat]
    zoom: 10.32, // starting zoom
    minZoom: 8, // the maximum level users can zoom out
  });

  // Add zoom and rotation controls to the map.
  map.addControl(new maplibregl.NavigationControl());

  // Define time groups for the slider
  const timeGroups = [
    { label: "12:00 AM - 2:59 AM", range: [0, 259] },
    { label: "3:00 AM - 5:59 AM", range: [300, 559] },
    { label: "6:00 AM - 8:59 AM", range: [600, 859] },
    { label: "9:00 AM - 11:59 AM", range: [900, 1159] },
    { label: "12:00 PM - 2:59 PM", range: [1200, 1459] },
    { label: "3:00 PM - 5:59 PM", range: [1500, 1759] },
    { label: "6:00 PM - 8:59 PM", range: [1800, 2059] },
    { label: "9:00 PM - 11:59 PM", range: [2100, 2359] },
  ];

  // add breakdown for colorizing KABCO values
  // id will be used to match the value in KABCO with the id property in the kabcoVals object
  // Add prop for checked to determine if the KABCO value is visible
  const kabcoVals = [
    {
      id: "1",
      text: "Fatal Crash",
      color: "#330601",
      size: 12,
      checked: true,
    },
    {
      id: "2",
      text: "Serious Injury Crash",
      color: "#8c1001",
      size: 10,
      checked: true,
    },
    {
      id: "3",
      text: "Minor Injury Crash",
      color: "#fc1d03",
      size: 7.5,
      checked: true,
    },
    {
      id: "4",
      text: "Possible Injury Crash",
      color: "#fc9083",
      size: 6,
      checked: true,
    },
    {
      id: "5",
      text: "Property Damage Only",
      color: "#fae1de",
      size: 4,
      checked: true,
    },
  ];

  // Set max value of slider based on the number of time groups
  const timeSlider = document.querySelector(".time-slider");
  timeSlider.setAttribute("max", timeGroups.length);

  // Function to filter crashes based on time
  function filterBy(timeRange) {
    let filters = [];

    // Add time filter if a time range is provided
    if (timeRange) {
      filters.push([
        "all",
        [">=", ["to-number", ["get", "Time"]], timeRange[0]],
        ["<=", ["to-number", ["get", "Time"]], timeRange[1]],
      ]);
    }

    // Gather selected KABCO categories based on checked properties
    const categories = kabcoVals
      .filter((item) => item.checked) // Keep only checked items
      .map((item) => item.id); // Get their ids

    // Add KABCO filter based on selected categories
    if (categories.length > 0) {
      filters.push(["in", ["get", "KABCO"], ["literal", categories]]);
    }
    // Combine filters: show crashes if any filter matches
    const combinedFilter = filters.length > 0 ? ["all", ...filters] : null;

    // Set the filters on the map layers
    map.setFilter("crashes", combinedFilter);
    map.setFilter("heatLayer", combinedFilter);
  }

  // Slider input event listener
  timeSlider.addEventListener("input", (e) => {
    const value = parseInt(e.target.value, 10);
    const timeRange = value === 0 ? null : timeGroups[value - 1].range;
    // Update the DIV element with the current time group label
    const sliderLabel = document.getElementById("slider-label");
    sliderLabel.textContent =
      value === 0 ? "All Crashes" : `${timeGroups[value - 1].label}`;

    filterBy(timeRange); // filterBy is invoked and passes timeRange for use
  });

  fetchData(); // invokes the fetchData function
  // console.log(data);

  // function to convert text to title case, source: https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
  function toTitleCase(str) {
    return str.replace(
      /\w\S*/g,
      (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
  }

  // Function to calculate crash statistics
  function crashStats(data) {
    const stats = {
      Sum: 0,
      MannerofCollision: {},
      InjuryKilledStats: {},
      NumberKilled: 0,
      NumberInjured: 0,
    };

    data.forEach(function (d) {
      // Handle Manner of Collision, including invalid or missing data
      let collisionType =
        d.MannerofCollision && d.MannerofCollision.trim() !== ""
          ? d.MannerofCollision
          : "UNKNOWN"; // Assign "Unknown" if data is missing or invalid

      if (!(collisionType in stats.MannerofCollision)) {
        stats.MannerofCollision[collisionType] = 0;
        stats.InjuryKilledStats[collisionType] = { injured: 0, killed: 0 };
      }

      stats.MannerofCollision[collisionType]++;

      if (+d.NumberKilled) {
        stats.NumberKilled += +d.NumberKilled;
        stats.InjuryKilledStats[collisionType].killed += +d.NumberKilled;
      }

      if (+d.NumberInjured) {
        stats.NumberInjured += +d.NumberInjured;
        stats.InjuryKilledStats[collisionType].injured += +d.NumberInjured;
      }
      stats.Sum++;
    });

    console.log(stats);

    d3Sorted = Object.entries(stats.MannerofCollision).sort(
      (a, b) => a[1] - b[1]
    );

    drawChart(stats, d3Sorted);

    console.log(d3Sorted);
  } // end crashStats function

  function createGeoJson(data, sidecar, fayette, tracts) {
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
            // TimeGroup: getTimeGroup(d.CollisionTime),
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

        // Apply the combined filter with current time range
        const currentTimeValue = parseInt(timeSlider.value);
        const timeRange =
          currentTimeValue === 0
            ? null
            : timeGroups[currentTimeValue - 1].range;

        filterBy(timeRange);
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
      // add counties
      map.addSource("fayette", {
        type: "geojson",
        data: fayette,
      });
      // then add the layer
      map.addLayer({
        id: "fayette-county",
        type: "line",
        source: "fayette",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#666",
          "line-width": 4,
        },
      });

      // add source first
      // add crashes
      map.addSource("crashes", {
        type: "geojson",
        data: geojson,
      });
      // then add the layer
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
          "circle-radius": createCircleRadius(kabcoVals),
          // color circles by KABCO values
          // style expressions, check maplibre documentation: https://maplibre.org/maplibre-style-spec/expressions/
          "circle-color": createFillColor(kabcoVals),
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10.5,
            0.1,
            12,
            1,
          ],
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10.5,
            0.1,
            12,
            0.5,
          ],
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
          // the following section controls how the data is weighted for the heat layer
          // below takes the KABCO, converts it to a number from a string (to-number)
          // then weighs the KABCO values as below:
          // ********** / (6 - [KABCO VALUE]) / 5 **********
          // So KABCO values of 1 have a weight of 1, and KABCO values of 5 have a weight of 0.2
          "heatmap-weight": ["/", ["-", 6, ["to-number", ["get", "KABCO"]]], 5],
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
            11, // the most zoomed out zoom level will have...
            0.8, // ...a 8% opacity on the heat layer (20% transparency), which will smoothly transition to...
            13, // ...zoom level 14, which will have an opacity of....
            0, // 0%, or 100% transparent
          ],
        },
      });

      filterBy(null);

      // Add a popup to the map
      map.on("click", "crashes", function (e) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const d = e.features[0].properties;
        let description = `<strong>KABCO:</strong> ${d.KABCO}<br>${
          d.STATS
        }<br>ID: ${d.ID}<br>Collision Time: ${
          d.Time
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
    }); // end map.on function to add crashes

    // using the array of KABCO and kabcoVals, create a createFillColor function to determine color to paint the crashes
    function createFillColor(kabcoVals) {
      const colors = kabcoVals.reduce((agg, item) => {
        // console.log(agg);
        agg.push(item.id);
        agg.push(item.color);
        return agg;
      }, []);
      // console.log(
      //   `["match", ["literal", ["get", 'KABCO']], ${colors}, "#CCC"]`);

      // Style expressions are tricky. They use strings and arrays to create a style.
      // This is a match expression that uses KABCO value to determine the color of the circle.
      // KABCO is not a variable in this case.
      return ["match", ["get", "KABCO"], ...colors, "#CCC"]; // default color is #CCC
    }

    // use kabcoVals sizes to return customized sizes for the crashes based on KABCO vals
    function createCircleRadius(kabcoVals) {
      const sizes = kabcoVals.reduce((agg, item) => {
        agg.push(item.id);
        agg.push(item.size);
        return agg;
      }, []);
      return ["match", ["get", "KABCO"], ...sizes, 5]; // Default size is 5
    }

    crashStats(data);
  } // end createGeoJson

  // functionality to add filtering/highlighting in createBar function
  function updateCrashes(geojson) {
    // if the layer is crashes
    if (map.getLayer("crashes")) {
      // set the paint properties defined below
      map.setPaintProperty("crashes", "circle-opacity", [
        // the below logic matches the case in teh geojson for the crashes layer where
        // the MannerofCollision values that are queried via any event are styled appropriately
        "case",
        ["==", ["get", "MannerofCollision"], geojson],
        1, // anything that equals the value queried has the opacity set to 1
        0, // anything that does not equal the value queried has the opacity set to 0.10 (completely transparent)
      ]);
      map.setPaintProperty("crashes", "circle-stroke-width", [
        "case",
        ["==", ["get", "MannerofCollision"], geojson],
        0.75,
        0,
      ]);
      map.setPaintProperty("crashes", "circle-stroke-color", [
        "case",
        ["==", ["get", "MannerofCollision"], geojson],
        "#222",
        "rgba(0,0,0,0.0)",
      ]);
    }
    // also turn off the heat layer so taht only the crash points are shown
    // if it is the heatLayer...
    if (map.getLayer("heatLayer")) {
      // if it is not filtered
      if (!filter) {
        filter = map.getFilter("heatLayer");
      }

      // Create a filter for MannerofCollision
      const mannerFilter = ["==", ["get", "MannerofCollision"], geojson];

      // Combine with the original filter
      let combinedFilter;
      if (filter) {
        combinedFilter = ["all", filter, mannerFilter];
      } else {
        combinedFilter = mannerFilter;
      }

      map.setFilter("heatLayer", combinedFilter);
    }
  }
  function resetCrashes(geojson) {
    // resets to defaults
    if (map.getLayer("crashes")) {
      // Set the paint properties back to the defaults defined when the layer was added
      map.setPaintProperty("crashes", "circle-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        10.5,
        0.1,
        12,
        1,
      ]);
      map.setPaintProperty("crashes", "circle-stroke-width", [
        "interpolate",
        ["linear"],
        ["zoom"],
        10.5,
        0.1,
        12,
        0.5,
      ]);
      map.setPaintProperty("crashes", "circle-stroke-color", "#222");
    }

    if (map.getLayer("heatLayer")) {
      // Restore the original filter
      map.setFilter("heatLayer", filter || null);
      // Reset the original filter variable
      filter = null;
    }
  }

  // Function to draw stacked bar chart
  function drawChart(stats, d3Sorted) {
    console.log(d3Sorted);
    // select the HTML element that will hold our chart
    const barChart = d3.select("#bar-chart");

    // determine the width and height of chart from container
    const width = 500;
    const height = 425;

    // append a new SVG element to the container
    const svg = barChart
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // x scale determines how wide each bar will be
    const x = d3
      .scaleLinear()
      .range([0, width])
      .domain([0, d3.max(d3Sorted, (d) => d[1])]); // returns the second value in the inner arrays, or our counts by each type

    const y = d3
      .scaleBand()
      .range([height, 0])
      .domain(d3Sorted.map((d) => d[0]))
      .padding(0.1); // spreads each bar from one another

    const color = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(d3Sorted.map((d) => d[0]));

    svg
      .selectAll("rect.total-bar")
      .data(d3Sorted)
      .enter()
      .append("rect")
      .attr("class", "bar total-bar")
      .attr("y", (d) => y(d[0]))
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", (d) => x(d[1]))
      .attr("fill", (d) => color(d[0]))
      .attr("stroke", "#000000")
      .attr("stroke-width", "0.75")
      .attr("transform", "translate(0 , 0)")
      .on("mouseover", (event, d) => {
        updateCrashes(d[0]);
        const injuryKilledStats = stats.InjuryKilledStats[d[0]];
        let tooltipContent = `
        ${d[0]}<br>
        <strong>${d[1].toLocaleString()}</strong> crashes<br>
        <strong>${injuryKilledStats.injured.toLocaleString()}</strong> injured<br>
        <strong>${injuryKilledStats.killed.toLocaleString()}</strong> killed
      `;
        tooltip
          .style("opacity", 1)
          .style("left", event.pageX + 30 + "px")
          .style("top", event.pageY - 30 + "px")
          .style("position", "absolute")
          .style("padding", "5px")
          .style("box-shadow", "0 0 15px rgba(0, 0, 0, 0.32)")
          .html(tooltipContent);
      })
      .on("mouseout", () => {
        resetCrashes();
        tooltip.style("opacity", 0);
      });

    // Add second stacked bars for injured
    svg
      .selectAll("rect.injury-bar")
      .data(d3Sorted)
      .enter()
      .append("rect")
      .attr("class", "bar injury-bar")
      .attr("y", (d) => y(d[0]))
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", (d) =>
        x(
          stats.InjuryKilledStats[d[0]].injured +
            stats.InjuryKilledStats[d[0]].killed
        )
      )
      .attr("fill", "#c5c7c6")
      .attr("opacity", 1)
      .attr("stroke", "#000000")
      .attr("stroke-width", "0.75")
      .on("mouseover", (event, d) => {
        const injuryKilledStats = stats.InjuryKilledStats[d[0]];
        let tooltipContent = `
        Number Injured/Killed<br>
        <strong>${injuryKilledStats.injured}</strong> injured<br>
        <strong>${injuryKilledStats.killed}</strong> killed<br>
      `;
        tooltip
          .style("opacity", 1)
          .style("left", event.pageX + 30 + "px")
          .style("top", event.pageY - 30 + "px")
          .style("position", "absolute")
          .style("padding", "5px")
          .style("box-shadow", "0 0 15px rgba(0, 0, 0, 0.32)")
          .html(tooltipContent);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    // text shadow
    svg
      .append("defs")
      .append("filter")
      .attr("id", "text-shadow")
      .append("feDropShadow")
      .attr("dx", 2) // Horizontal shadow offset
      .attr("dy", 2) // Vertical shadow offset
      .attr("stdDeviation", 2) // Shadow blur amount
      .attr("flood-color", "black") // Shadow color
      .attr("flood-opacity", 0.6); // Shadow opacity

    // Label each bar
    svg
      .selectAll("text.label")
      .data(d3Sorted)
      .enter()
      .append("text")
      .text((d) => `${d[0]}`) // Set the text of each label
      .attr("x", (d) => {
        // set the x position of each label
        if (x(d[1]) / width < 0.5) {
          return x(d[1]) + 5;
        } else {
          return 5;
        }
      })
      .attr("y", (d) => y(d[0]) + y.bandwidth() / 1.75)
      .attr("text-anchor", "left")
      .attr("fill", "whitesmoke")
      .attr("filter", "url(#text-shadow)");
  }
})();

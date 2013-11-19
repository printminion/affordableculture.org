var initLocation = new google.maps.LatLng(52.520816, 13.410186); //Berlin

var neighborhoods = [];
var markers = [];

var iterator = 0;
var map;
var dontCallSearch = false;

function initialize() {
    var mapOptions = {
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: false,
        center: initLocation,
        'scrollwheel': false
    };

    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

    var input = /** @type {HTMLInputElement} */(
        document.getElementById('search'));

    var autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);

    google.maps.event.addListener(autocomplete, 'place_changed', function () {
        console.log('place_changed', map.getZoom(), map.getCenter());


        var place = autocomplete.getPlace();
        if (!place.geometry) {
            return;
        }

        $('#map-canvas').removeClass('opacity');
        $('#myCarousel').hide();

        var location = place.geometry.location;
        map.setCenter(location);
        map.setZoom(13);  // Why 17? Because it looks good.

        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:place_changed', search);

        if (!dontCallSearch) {
            var inputSearchByLocation = $('#searchByLocation');
            inputSearchByLocation.val(search);
            inputSearchByLocation.trigger('input');
        }

    });

    google.maps.event.addListener(map, 'zoom_changed', function () {
        console.log('zoom_changed', map.getZoom(), map.getCenter());

        //zoom_changed
        var location = map.getCenter();
        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:zoom_changed', search);

        if (!dontCallSearch) {
            var inputSearchByLocation = $('#searchByLocation');
            inputSearchByLocation.val(search);
            inputSearchByLocation.trigger('input');
        }

    });

//    google.maps.event.addListener(map, 'center_changed', function () {
//        console.log('center_changed', map.getZoom(), map.getCenter());
//
//        //zoom_changed
//        var location = map.getCenter();
//        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
//        console.log('search', search);
//
//        $('#searchByLocation').val(search);
//
//    });


    google.maps.event.addListener(map, 'mouseup', function () {
        console.log('mouseup', map.getZoom(), map.getCenter());

        //zoom_changed
        var location = map.getCenter();
        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:mouseup', search);

        $('#searchByLocation').val(search);

    });

    google.maps.Map.prototype.clearMarkers = function () {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = [];
    };

}

function addMarker(neighborhood, attraction) {
    var marker = new google.maps.Marker({
        position: neighborhood,
        map: map,
        draggable: false
    });

    var infowindow = new google.maps.InfoWindow();

    google.maps.event.addListener(marker, 'click', function () {
        infowindow.setContent(attraction.name + "<br>" + attraction.address);
        infowindow.open(map, this);
    });

    markers.push(marker);
}


google.maps.event.addDomListener(window, 'load', initialize);
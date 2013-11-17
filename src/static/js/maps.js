var berlin = new google.maps.LatLng(52.520816, 13.410186);

var neighborhoods = [];

var markers = [];
var iterator = 0;

var map;


function initialize() {
    var mapOptions = {
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        center: berlin
    };

    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

    google.maps.Map.prototype.clearMarkers = function () {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = [];
    };

}


function dropMarkers() {
    for (var i = 0; i < neighborhoods.length; i++) {
        setTimeout(function () {
            addMarker();
        }, i * 200);
    }
}

function addMarker() {
    var marker = new google.maps.Marker({
        position: neighborhoods[iterator],
        map: map,
        draggable: false,
        animation: google.maps.Animation.DROP
    });

//var infowindow = new google.maps.InfoWindow();

    google.maps.event.addListener(marker, 'click', function () {

        console.log('click');
        //infowindow.setContent(place.name + " " + place.rating + " " + place.formatted_address);
//                infowindow.setContent('xxx');
//
//                infowindow.open(map, this);
    });

    markers.push(marker);
    iterator++;
}


google.maps.event.addDomListener(window, 'load', initialize);
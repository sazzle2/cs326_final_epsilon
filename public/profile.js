'use strict';

async function getFavorites() {
	console.log('attempted getFavorite');
    let response = await fetch('/user/favorites/view',{
        method: 'GET'
    });
    if (response.ok) {
        let arr = await response.json(); // array of favorites
        document.getElementById('favoriteList').innerHTML = '';
        for(let i = 0; i < arr.length; i++) {
            let newDiv = document.createElement('div');
            newDiv.innerHTML = JSON.stringify(arr[i]);
            document.getElementById("favoriteList").append(newDiv);
        }
    }
    else {
        alert("An error has occured. gahhhh!!");
    }
}

//test comment
async function addFavorite() {
	console.log(typeof(document.getElementById("adding").value));
    let response = await fetch('/user/favorites/add/' + document.getElementById("adding").value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
        getFavorites();
    }
    else {
        alert("An error has occured. :(");
    }
}

async function logOut() {
	let response = await fetch('/logout', {
		method: 'POST'
	}); if (response.ok) {
		alert('successfully logged out');
	} else {
		alert('trapped forever :v');
	}
}

async function deleteAccount() {
    let response = await fetch('/user/delete/', {
        method: 'DELETE'
    });
    if (response.ok) {
    	alert("The account has been deleted");
    } 
    else {
        alert("An error has occured.");
    }
}

window.addEventListener('load', () => {
  document.getElementById("search").addEventListener("click", addFavorite);
  document.getElementById('logout').addEventListener('click', logOut);
  document.getElementById("delete").addEventListener("click", deleteAccount);
  getFavorites();
});

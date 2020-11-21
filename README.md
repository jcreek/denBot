# denBot

A queue bot to enable multiple (default 4) Pokémon players to go on an adventure together via Discord.

## Features

Users can join and leave a queue. When the queue is full users are DMed a code to join the in-game lobby. They have access to a private text channel in the discord server that the captain can manually delete when ready, or that will be automatically removed after a period of time.

Commands:

* q   - Join the queue
* q pokemon ign   - Join the queue (first player can set the pokemon and their in-game name)
* lq  - Leave the queue
* sq  - Show the queue
* start - Vote to start the adventure early, without the full number of players (all players in the queue must use this to start early)
* cq  - Clear the queue (admin-only, not to be shared with normal users)
* ru  - Remove a tagged user from the queue (admin-only, not to be shared with normal users)
* dc  - Delete an adventure channel (only the captain can use this)
* help - Show all user commands
* adminhelp - Show all admin commands

## Installing Docker

If you're on Windows, visit [this website](https://docs.docker.com/docker-for-windows/install/) and download and install Docker Desktop. You'll probably need to install WSL and do some Windows updates. Once it's all installed you'll get a lovely GUI that you can use if you want to.

For Mac and Linux users, Google is your friend here.

## Dockerize the bot

To build a docker image, open a command window in the project directory and run:

`docker build -t denbot .`

For a sanity check, you can run `docker images` and it should be displayed in that list.

## Running the Docker container

Running the bot with -d runs the container in detatched mode (as in it runs in the background). If you want to see what is happening, remove that option.

`docker run -d denbot`

You can use CTRL+C to exit out of this command window. If you're using Windows, Docker Desktop will now show your bot under 'Containers/Apps', from where you can easily stop and start it using the GUI.

### More information

If you want more of a sanity check here are some following commands you can run the following commands:

* To view details of running containers: `docker ps`
* To view the container's logs (with a number instead of the <> section): `docker logs <our container's ID>`

To access the command line inside the docker container you can run:

`docker exec -it <container id> /bin/bash`

## Future feature suggestions

* If the party want to continue with the same people and the same link code they can do !again (only in the private chat) to run again and get the party for 30 more mins (denBot would also post the link code again so people can see it without scrolling) - using something like https://stackoverflow.com/questions/36563749/how-i-extend-settimeout-on-nodejs and an array of all the queues, removing those and their deletion functions each time an adventure channel is deleted
